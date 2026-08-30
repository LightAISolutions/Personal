#Requires AutoHotkey v2.0
#SingleInstance Force
; ═══════════════════════════════════════════════════════════════════════════
; AutoUpdate.ahk — LightAISolutions greenfield pull-based auto-updater
; Polls GitHub Pages for per-file version markers; fetches via GitHub API
; on version mismatch; writes to configured target paths. Self-updating.
; ═══════════════════════════════════════════════════════════════════════════

VERSION := "v01.01a"

; === GitHub configuration ===
GITHUB_OWNER  := "LightAISolutions"
GITHUB_REPO   := "lightaisolutions"
GITHUB_BRANCH := "main"

; === Polling configuration ===
POLL_INTERVAL := 15000                               ; 15s between polls
PAGES_BASE    := "https://" GITHUB_OWNER ".github.io/" GITHUB_REPO "/"
API_BASE      := "https://api.github.com/repos/" GITHUB_OWNER "/" GITHUB_REPO

; === IPC reload message (for AHK self-update via ReloadHandler.ahk) ===
WM_AHK_RELOAD := 0x0500                              ; WM_USER + 256

; === Manual targets (local-only scratchpad, gitignored) ===
; Developers can add targets through the Manual Targets panel embedded in the
; main window; entries persist to AutoUpdate.manual-targets.ini and load
; alongside the hardcoded self target so they're actually polled + updated
; locally before being handed off to Claude for official integration via the
; "Copy for Claude" button.
MANUAL_TARGETS_INI := A_ScriptDir "\AutoUpdate.manual-targets.ini"

; === Manifest (repo-tracked active auto-update targets) ===
; auto-update-targets.ini lives in the repo and lists every script that's
; currently being auto-updated. For each entry the manifest carries the
; remote/version paths and reload flags; the per-machine local path is NOT
; stored here — it's resolved at runtime by joining each manifest entry
; with a [localpath:<Name>] entry in LOCALPATHS_PATH (per-machine
; persisted; promoted from an intent on first sight). This keeps
; repo-shared config and per-machine config cleanly separated.
MANIFEST_PATH := A_ScriptDir "\auto-update-targets.ini"

; === Local paths (persisted per-machine target locations) ===
; AutoUpdate.localpaths.ini holds [localpath:<Name>] sections, one per
; integrated manifest target, each storing the local folder where this
; machine wants the target file written. Auto-populated when a manifest
; entry first appears with a matching [intent:<Name>] in the wishlist —
; AutoUpdate "promotes" the intent's localFolder into a localpath entry
; and deletes the intent. Also populated by the "Edit Path…" button on
; the status table. Survives intent removal so deleting wishlist items
; (which the GUI presents as a disposable queue) is safe by design.
LOCALPATHS_PATH := A_ScriptDir "\AutoUpdate.localpaths.ini"

; === GUI layout constants ===
; The main window is a two-column layout: LEFT = monitoring (countdown,
; status table, log, action buttons), RIGHT = manual targets (heading, help,
; list, form, action buttons). Footer spans full width below both columns.
; Centralizing the column geometry here keeps BuildGui + BuildManualTargets-
; Section in sync — change COL_W once and both columns retune.
COL_W       := 620                                   ; px — both columns
COL_GAP     := 20                                    ; px — between columns
RIGHT_COL_X := 10 + COL_W + COL_GAP                  ; ≈ 650 (xm + col1 + gap)
FULL_W      := COL_W * 2 + COL_GAP                   ; ≈ 1260 (footer span)

; === TARGETS — populated by InitTargets() ===
TARGETS := []

; === State ===
GITHUB_TOKEN      := ""                              ; loaded from config.ini
LastCheckTime     := ""
LastStatus        := Map()
SelfUpdatePending := false
CountdownSeconds  := 3
IsChecking        := false
LogBuffer         := []                              ; rolling in-memory log
LogMaxLines       := 200
FailureCounts     := Map()                           ; target.name → consecutive failure count
BackoffUntil      := Map()                           ; target.name → A_TickCount when next poll allowed
RateLimitResetAt  := 0                               ; A_TickCount to wait until if rate-limited globally
ManifestSignature := ""                              ; last (manifest + intents + localpaths) content seen — used to skip per-poll rebuilds when nothing changed

; ─── Initialization flow ──────────────────────────────────────────────
LoadConfig()
InitTargets()
EnsureLogDir()
BuildGui()
BuildTrayMenu()
SetTimer(UpdateCountdown, 1000)
MainGui.Show("AutoSize")
Log("AutoUpdate " VERSION " started; monitoring " TARGETS.Length " target(s)")
Persistent()

; ═══════════════════════════════════════════════════════════════════════════
; Targets
; ═══════════════════════════════════════════════════════════════════════════

InitTargets() {
    global TARGETS
    ; TARGET schema:
    ;   name:         human-readable name (used in GUI + log)
    ;   remotePath:   path in the repo (for api.github.com/contents/...)
    ;   versionFile:  path on GitHub Pages (polled every POLL_INTERVAL)
    ;   targetPath:   absolute path on disk where content is written
    ;   isSelf:       true = this AutoUpdate.ahk itself (triggers Reload())
    ;   reloadSignal: true = post WM_AHK_RELOAD to running AHK instances
    ;   enabled:      per-target kill switch
    TARGETS.Push({
        name:         "AutoUpdate.ahk (self)",
        remotePath:   "autoHotkey/AutoUpdate.ahk",
        versionFile:  "ahk-versions/autoupdateahk.version.txt",
        targetPath:   A_ScriptFullPath,
        isSelf:       true,
        reloadSignal: false,
        enabled:      true,
        manual:       false
    })
    ; Manifest-driven targets (auto-update-targets.ini) are appended next.
    ; The self-target stays hardcoded so AutoUpdate can bootstrap without
    ; depending on a manifest file that itself gets auto-updated.
    ; Fetch first (refreshes the on-disk cache from the repo), then parse,
    ; then seed ManifestSignature so the first poll cycle's
    ; RebuildTargetsFromManifest doesn't redundantly rebuild from identical
    ; state.
    global ManifestSignature
    manifestContent := FetchAndCacheManifest()
    LoadManifestTargets()
    ManifestSignature := ComputeManifestSignature(manifestContent)
    ; Manual Targets entries (intents) are NOT pushed here — they're a
    ; pre-handoff wishlist for Claude. Once Claude integrates an intent it
    ; appears in the manifest above and gets joined to the intent's local
    ; folder by LoadManifestTargets to become an active target.
}

; ─── Local-paths store (per-machine persisted target locations) ─────────
; Returns Map<name, folder> from AutoUpdate.localpaths.ini.
GetLocalPaths() {
    global LOCALPATHS_PATH
    out := Map()
    if !FileExist(LOCALPATHS_PATH)
        return out
    sections := ""
    try {
        sections := IniRead(LOCALPATHS_PATH)
    } catch {
        return out
    }
    for section in StrSplit(sections, "`n") {
        if InStr(section, "localpath:") != 1
            continue
        name := SubStr(section, 11)
        if name = ""
            continue
        out[name] := IniRead(LOCALPATHS_PATH, section, "folder", "")
    }
    return out
}

WriteLocalPath(name, folder) {
    global LOCALPATHS_PATH
    IniWrite(folder, LOCALPATHS_PATH, "localpath:" name, "folder")
}

DeleteLocalPath(name) {
    global LOCALPATHS_PATH
    if !FileExist(LOCALPATHS_PATH)
        return
    try IniDelete(LOCALPATHS_PATH, "localpath:" name)
}

; Reads auto-update-targets.ini and pushes one TARGETS entry per [target:*]
; section. The local target path is resolved by joining each manifest entry
; with a [localpath:<Name>] in AutoUpdate.localpaths.ini. If no localpath
; exists yet but a matching [intent:<Name>] does, the intent is "promoted":
; its localFolder is written to localpaths and the intent itself is deleted
; from the wishlist (the wishlist is a disposable queue — once Claude
; integrates it, the local-path mapping moves to its permanent home).
; Manifest entries with neither a localpath nor an intent are still pushed
; (so they appear in the GUI) but flagged `unconfigured: true` and skipped
; during polls — they show "⚠ no local folder configured" until the
; developer clicks "Edit Path…" on the status table.
; Fetches the manifest from the repo via api.github.com and writes it to
; MANIFEST_PATH if the content differs from the existing cache. Falls back
; gracefully on fetch failure (no network, rate limit, no token) — the
; existing local cache is left intact. Returns the content actually
; available locally after this call (fetched-and-cached, or pre-existing
; cache, or "" if neither exists). Pulled out of LoadManifestTargets so
; the per-poll RebuildTargetsFromManifest can fetch + compute a signature
; first and decide whether to do any further work.
FetchAndCacheManifest() {
    global MANIFEST_PATH
    fetched := ""
    try fetched := FetchRemoteContent("autoHotkey/auto-update-targets.ini")
    if fetched != "" {
        existing := ""
        if FileExist(MANIFEST_PATH)
            try existing := FileRead(MANIFEST_PATH, "UTF-8")
        if fetched != existing {
            try {
                f := FileOpen(MANIFEST_PATH, "w", "UTF-8")
                if f {
                    f.Write(fetched)
                    f.Close()
                    try Log(existing = ""
                        ? "Manifest cached from repo at " MANIFEST_PATH
                        : "Manifest refreshed from repo (changed)")
                }
            } catch as err {
                try Log("FetchAndCacheManifest: cache write failed: " err.Message)
            }
        }
        return fetched
    }
    ; Fetch failed — fall back to whatever's on disk.
    if FileExist(MANIFEST_PATH) {
        try return FileRead(MANIFEST_PATH, "UTF-8")
    }
    return ""
}

; Computes a stable signature from the three files that drive the manifest-
; resolution logic: the manifest itself, the intents wishlist, and the
; persisted localpaths. Any one of them changing means a rebuild needs to
; fire. Manifest content is passed in (already in hand from
; FetchAndCacheManifest) to avoid a redundant disk read.
ComputeManifestSignature(manifestContent) {
    global MANUAL_TARGETS_INI, LOCALPATHS_PATH
    intents := ""
    if FileExist(MANUAL_TARGETS_INI)
        try intents := FileRead(MANUAL_TARGETS_INI, "UTF-8")
    localpaths := ""
    if FileExist(LOCALPATHS_PATH)
        try localpaths := FileRead(LOCALPATHS_PATH, "UTF-8")
    return manifestContent "`n||M||`n" intents "`n||I||`n" localpaths
}

LoadManifestTargets() {
    global TARGETS, MANIFEST_PATH
    ; Pure parser — reads MANIFEST_PATH, joins each [target:*] section
    ; with localpaths (or promotes a matching intent), pushes TARGETS.
    ; Fetching + caching the manifest is FetchAndCacheManifest's job;
    ; this function expects MANIFEST_PATH to already reflect the desired
    ; manifest content (or to be missing, in which case we no-op).
    if !FileExist(MANIFEST_PATH) {
        try Log("LoadManifestTargets: manifest unavailable (no local cache)")
        return
    }
    sections := ""
    try {
        sections := IniRead(MANIFEST_PATH)
    } catch {
        return
    }
    ; Snapshot localpaths and intents once so we can join by name without
    ; re-reading per row.
    localPaths := GetLocalPaths()
    intentByName := Map()
    for intent in GetIntents()
        intentByName[intent.name] := intent
    for section in StrSplit(sections, "`n") {
        if InStr(section, "target:") != 1
            continue
        name := SubStr(section, 8)
        if name = ""
            continue
        filename        := IniRead(MANIFEST_PATH, section, "filename", name ".ahk")
        remotePath      := IniRead(MANIFEST_PATH, section, "remotePath", "")
        versionFile     := IniRead(MANIFEST_PATH, section, "versionFile", "")
        reloadSignal    := ParseIniBool(IniRead(MANIFEST_PATH, section, "reloadSignal", "true"))
        manifestEnabled := ParseIniBool(IniRead(MANIFEST_PATH, section, "enabled", "true"))
        ; Required fields — skip the entry if either is blank (malformed manifest).
        if remotePath = "" || versionFile = "" {
            try Log("Manifest [" section "] missing remotePath or versionFile; skipped")
            continue
        }
        ; Resolve the per-machine local folder. Order:
        ;   1. localpaths file (persisted, survives intent removal)
        ;   2. intent (wishlist) — if found, promote: write to localpaths
        ;      and delete the intent so the wishlist stays as a pure queue
        ; Either source produces a folder; "" means unconfigured.
        folder := ""
        if localPaths.Has(name)
            folder := Trim(localPaths[name])
        if folder = "" && intentByName.Has(name) {
            folder := Trim(intentByName[name].localFolder)
            if folder != "" {
                ; Promote the intent → localpath, then delete the intent.
                WriteLocalPath(name, folder)
                DeleteIntentSection(name)
                try Log("Promoted intent [" name "] → localpath, removed from wishlist")
            }
        }
        targetPath := ""
        unconfigured := true
        if folder != "" {
            targetPath := folder "\" filename
            unconfigured := false
        }
        TARGETS.Push({
            name:         name,
            remotePath:   remotePath,
            versionFile:  versionFile,
            targetPath:   targetPath,
            isSelf:       false,
            reloadSignal: reloadSignal,
            enabled:      manifestEnabled && !unconfigured,
            manual:       false,
            unconfigured: unconfigured
        })
        if unconfigured
            try Log("Manifest [" name "] has no local path — click Edit Path… on the status row")
    }
}

; Called from CheckForUpdates each cycle. Fetches the latest manifest,
; computes a signature from manifest + intents + localpaths, and only
; runs the actual rebuild (drop non-self TARGETS → reparse → repaint
; StatusLV + intent list) when the signature differs from last seen.
; In steady-state where no files have changed, this is a single string
; compare against ManifestSignature — no array churn, no LV.Delete +
; re-Add cycle, no selection-preservation dance, no Edit Path button
; state churn. The cost of a real rebuild is unchanged from before.
; The signature includes localpaths so that an Edit Path… edit (or any
; other localpath mutation) also fires a rebuild, even though the
; manifest and intents file are untouched in that case.
RebuildTargetsFromManifest() {
    global TARGETS, ManifestSignature
    manifestContent := FetchAndCacheManifest()
    sig := ComputeManifestSignature(manifestContent)
    if sig = ManifestSignature
        return  ; nothing has changed since last rebuild — skip everything
    ManifestSignature := sig
    keep := []
    for t in TARGETS
        if t.isSelf
            keep.Push(t)
    TARGETS := keep
    LoadManifestTargets()
    RebuildStatusLV()
    RefreshIntentList()
}

; Wipes and rebuilds StatusLV rows from current TARGETS. Run after
; RebuildTargetsFromManifest mutates TARGETS, so the LV row indexes
; stay aligned with TARGETS indexes (UpdateGuiRow indexes by row).
; Preserves the user's row selection across the wipe by capturing the
; selected target's name (stable across rebuilds — index isn't, since
; manifest entries can come and go) and re-selecting the matching row
; afterward. Then refreshes the Edit Path… button's enabled state to
; match the (possibly restored) selection.
RebuildStatusLV() {
    global StatusLV, TARGETS
    if !IsSet(StatusLV) || !IsObject(StatusLV)
        return
    selectedName := ""
    selectedRow := StatusLV.GetNext(0)
    if selectedRow > 0 && selectedRow <= TARGETS.Length
        selectedName := TARGETS[selectedRow].name
    StatusLV.Delete()
    for t in TARGETS {
        if t.HasOwnProp("unconfigured") && t.unconfigured {
            StatusLV.Add("", t.name " (no local folder)",
                         "—", "—", "⚠ click Edit Path…", "—")
        } else {
            label := t.enabled ? t.name : t.name " (disabled)"
            StatusLV.Add("", label, "—", "—", "waiting…", t.targetPath)
        }
    }
    if selectedName != "" {
        Loop TARGETS.Length {
            if TARGETS[A_Index].name = selectedName {
                StatusLV.Modify(A_Index, "Select Focus")
                break
            }
        }
    }
    UpdateEditPathButtonState()
}

; Keeps the Edit Path… button's enabled state in sync with the StatusLV
; selection. Disabled when nothing is selected (no row to act on) or when
; the self-target row is selected (its path is fixed to A_ScriptFullPath
; by design — relocating the running script is out of scope for this
; button). Bound to StatusLV's ItemSelect event and called explicitly
; from RebuildStatusLV after restoring a per-poll selection.
UpdateEditPathButtonState() {
    global StatusLV, BtnEditPath, TARGETS
    if !IsSet(BtnEditPath) || !IsObject(BtnEditPath)
        return
    row := StatusLV.GetNext(0)
    enable := row > 0 && row <= TARGETS.Length && !TARGETS[row].isSelf
    BtnEditPath.Enabled := enable
}

; ─── Intents (pre-handoff wishlist) ──────────────────────────────────────
; Manual Targets entries are now "intents" — pending AHK scripts the
; developer wants Claude to add to the auto-updater. Each intent carries a
; Name, a one-paragraph "What it does" description, and a Local Folder where
; the future script should land on this machine. Intents are persisted to
; AutoUpdate.manual-targets.ini under [intent:Name] sections; they NEVER
; enter the live TARGETS array (no polling, no fetching). They're consumed
; only by the Copy-for-Claude button, which assembles them into a self-
; contained handoff prompt.

; INI values are line-based (key=value, one per line) and can't span
; newlines natively — IniWrite would truncate at the first `\n`. The intent
; description is multi-line, so we encode newlines as a literal ||N||
; sentinel before writing and decode back when reading. The sentinel is
; uncommon enough in natural prose that collisions are practically zero.
EncodeMultilineForIni(text) {
    text := StrReplace(text, "`r`n", "||N||")
    return StrReplace(text, "`n", "||N||")
}

; Case-insensitive INI boolean parser. INI values are bare strings, so a
; case-sensitive `value = "true"` compare silently turns `True` / `TRUE`
; into `false` and disables the target — the exact footgun called out in
; v12.39r's heads-up. This helper normalizes the comparison so any casing
; of `true` is true, and anything else (including blank, `false`, `False`,
; `0`, garbage) is false. Keep the helper narrow — only `true`/anything
; semantics; do NOT extend to `1`/`yes`/`no` aliases without a discussion,
; the manifest writer always emits lowercase `true`/`false` so the helper's
; only job is to forgive case drift on hand-edited values.
ParseIniBool(value) {
    return StrLower(Trim(value)) = "true"
}

DecodeMultilineFromIni(text) {
    return StrReplace(text, "||N||", "`r`n")
}

; Reads AutoUpdate.manual-targets.ini and returns intent snapshots in INI
; section order. Each snapshot is a plain object with .name, .description,
; .localFolder. Returns [] if the INI doesn't exist or has no intents.
GetIntents() {
    global MANUAL_TARGETS_INI
    out := []
    if !FileExist(MANUAL_TARGETS_INI)
        return out
    try {
        sections := IniRead(MANUAL_TARGETS_INI)  ; "`n"-separated section names
    } catch {
        return out
    }
    for section in StrSplit(sections, "`n") {
        if InStr(section, "intent:") != 1
            continue
        name := SubStr(section, 8)
        if name = ""
            continue
        out.Push({
            name:        name,
            description: DecodeMultilineFromIni(
                            IniRead(MANUAL_TARGETS_INI, section, "description", "")),
            localFolder: IniRead(MANUAL_TARGETS_INI, section, "localFolder", "")
        })
    }
    return out
}

; Writes a single intent section. Used for both add + update — the section
; key is the name, so updating an intent by name overwrites cleanly. The
; description is encoded for INI safety (see EncodeMultilineForIni above).
WriteIntentSection(name, description, localFolder) {
    global MANUAL_TARGETS_INI
    section := "intent:" name
    IniWrite(EncodeMultilineForIni(description),
             MANUAL_TARGETS_INI, section, "description")
    IniWrite(localFolder, MANUAL_TARGETS_INI, section, "localFolder")
}

; Deletes an intent section by name.
DeleteIntentSection(name) {
    global MANUAL_TARGETS_INI
    if !FileExist(MANUAL_TARGETS_INI)
        return
    try IniDelete(MANUAL_TARGETS_INI, "intent:" name)
}

; ═══════════════════════════════════════════════════════════════════════════
; GUI construction
; ═══════════════════════════════════════════════════════════════════════════

BuildGui() {
    global MainGui, CountdownLabel, StatusLV, LastCheckLabel, LogBox,
           BtnEditPath,
           VERSION, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, GITHUB_TOKEN,
           TARGETS, CountdownSeconds,
           COL_W, RIGHT_COL_X, FULL_W

    MainGui := Gui("+Resize", "AutoUpdate " VERSION)
    MainGui.SetFont("s10", "Segoe UI")
    MainGui.BackColor := "1E1E2E"

    ; ─── LEFT COLUMN — Monitoring ────────────────────────────────────────
    MainGui.SetFont("s14 bold", "Segoe UI")
    CountdownLabel := MainGui.AddText("xm w" COL_W " Center cCDD6F4",
        "Next check in: " CountdownSeconds "s")

    MainGui.SetFont("s9 norm", "Consolas")
    StatusLV := MainGui.AddListView(
        "xm w" COL_W " h120 -Multi ReadOnly Background313244 cCDD6F4",
        ["Target", "Local", "Remote", "Status", "Location"])
    StatusLV.ModifyCol(1, 175)
    StatusLV.ModifyCol(2, 60)
    StatusLV.ModifyCol(3, 60)
    StatusLV.ModifyCol(4, 105)
    StatusLV.ModifyCol(5, 200)
    ; Initial population — same logic the per-poll rebuild uses, so the
    ; "⚠ click Edit Path…" warning text stays consistent everywhere.
    RebuildStatusLV()
    ; Double-click any row to open the target file's containing folder in
    ; Windows Explorer with the file pre-selected. ItemSelect updates the
    ; Edit Path… button's enabled state — disabled when nothing is selected
    ; or when the self-target row is selected (its path is fixed by design).
    StatusLV.OnEvent("DoubleClick", OnStatusRowDoubleClick)
    StatusLV.OnEvent("ItemSelect", (*) => UpdateEditPathButtonState())

    MainGui.SetFont("s9 norm", "Segoe UI")
    LastCheckLabel := MainGui.AddText("xm w" COL_W " Center c89B4FA",
        "Last check: not yet")

    MainGui.SetFont("s9 norm", "Segoe UI")
    MainGui.AddText("xm w" COL_W " c89B4FA", "Log:")
    MainGui.SetFont("s8 norm", "Consolas")
    ; Log box is taller than before (h140 → h260) — the recovered vertical
    ; space comes from the two-column layout, and a taller log keeps more
    ; recent activity visible without scrolling.
    LogBox := MainGui.AddEdit(
        "xm w" COL_W " h260 ReadOnly -Wrap +HScroll Background313244 cCDD6F4", "")

    MainGui.SetFont("s10", "Segoe UI")
    BtnCheckNow := MainGui.AddButton("xm Section w110", "Check Now")
    BtnCheckNow.OnEvent("Click", (*) => ManualCheck())
    BtnOpenLog := MainGui.AddButton("ys x+10 w110", "Open Log File")
    BtnOpenLog.OnEvent("Click", (*) => OpenLogFile())
    BtnEditPath := MainGui.AddButton("ys x+10 w110", "Edit Path…")
    BtnEditPath.OnEvent("Click", (*) => OnEditLocalPath())
    BtnEditPath.Enabled := false   ; nothing selected at launch — see UpdateEditPathButtonState
    BtnHide := MainGui.AddButton("ys x+10 w110", "Hide to Tray")
    BtnHide.OnEvent("Click", (*) => MainGui.Hide())

    ; ─── RIGHT COLUMN — Manual Targets ───────────────────────────────────
    BuildManualTargetsSection(MainGui)

    ; ─── Footer (full width, below both columns) ─────────────────────────
    ; xm resets X to the left margin; AHK auto-places Y below the previous
    ; control (the rightmost button in the right column, which is the
    ; lowest control on screen given the right column is the taller one).
    MainGui.SetFont("s8 norm", "Segoe UI")
    MainGui.AddText("xm w" FULL_W " Center c6C7086",
        GITHUB_OWNER "/" GITHUB_REPO " (" GITHUB_BRANCH ")"
        . " · Token: " (GITHUB_TOKEN != "" ? "configured" : "NOT SET")
        . " · Targets: " TARGETS.Length)

    MainGui.OnEvent("Close", (*) => MainGui.Hide())
}

BuildTrayMenu() {
    global VERSION, TARGETS
    A_TrayMenu.Delete()
    A_TrayMenu.Add("Show / Hide", (*) => ToggleGui())
    A_TrayMenu.Add("Check Now",   (*) => ManualCheck())
    A_TrayMenu.Add("Open Log",    (*) => OpenLogFile())
    A_TrayMenu.Add()
    A_TrayMenu.Add("Exit",        (*) => ExitApp())
    A_TrayMenu.Default := "Show / Hide"
    A_IconTip := "AutoUpdate " VERSION " — " TARGETS.Length " target(s)"
}

ToggleGui() {
    global MainGui
    if WinExist("ahk_id " MainGui.Hwnd) {
        if DllCall("IsWindowVisible", "ptr", MainGui.Hwnd)
            MainGui.Hide()
        else
            MainGui.Show()
    } else {
        MainGui.Show()
    }
}

ManualCheck() {
    global CountdownSeconds, POLL_INTERVAL
    CheckForUpdates()
    CountdownSeconds := POLL_INTERVAL // 1000
}

UpdateCountdown() {
    global CountdownSeconds, CountdownLabel, IsChecking, POLL_INTERVAL
    if IsChecking {
        CountdownLabel.Text := "Checking now…"
        return
    }
    if CountdownSeconds <= 0 {
        CountdownSeconds := POLL_INTERVAL // 1000
        CheckForUpdates()
        return
    }
    CountdownSeconds--
    CountdownLabel.Text := "Next check in: " CountdownSeconds "s"
}

UpdateGuiRow(index, localVer, remoteVer, status) {
    global StatusLV, TARGETS
    target := TARGETS[index]
    if target.HasOwnProp("unconfigured") && target.unconfigured {
        label := target.name " (no local folder)"
        loc   := "—"
    } else {
        label := target.enabled ? target.name : target.name " (disabled)"
        loc   := target.targetPath
    }
    StatusLV.Modify(index, "", label, localVer, remoteVer, status, loc)
}

; Edit Path… button handler. Prompts for a folder, writes it to
; localpaths, then rebuilds TARGETS so the change is visible immediately
; without waiting for the next poll. Refuses to operate on the self-target
; (its path is fixed to A_ScriptFullPath by design) or on no selection.
OnEditLocalPath() {
    global StatusLV, TARGETS
    ; Defensive guards — the button is disabled when no row is selected or
    ; when the self-target row is selected (UpdateEditPathButtonState keeps
    ; that in sync), so reaching this handler with row=0 or target.isSelf
    ; would mean the button state lagged behind the selection. Silent return
    ; rather than a MsgBox — the user didn't act, the state did.
    row := StatusLV.GetNext(0)
    if row < 1 || row > TARGETS.Length
        return
    target := TARGETS[row]
    if target.isSelf
        return
    ; Default the picker to the current localpath's folder when one
    ; exists, otherwise the developer's Desktop.
    initialDir := A_Desktop
    existing := GetLocalPaths()
    if existing.Has(target.name) && existing[target.name] != ""
        initialDir := existing[target.name]
    folder := DirSelect("*" initialDir, 3,
        "Pick the folder where " target.name " should land on this machine")
    if folder = ""
        return
    WriteLocalPath(target.name, folder)
    Log("Edit Path: [" target.name "] localpath set to " folder)
    RebuildTargetsFromManifest()
}

; Double-click handler for the status table — opens File Explorer at the
; target file's containing folder with the file selected. Falls back to a
; folder-only open if the file doesn't exist on disk yet.
OnStatusRowDoubleClick(LV, rowIndex) {
    global TARGETS
    if rowIndex < 1 || rowIndex > TARGETS.Length
        return
    path := TARGETS[rowIndex].targetPath
    if path = ""
        return
    if FileExist(path) {
        Run('explorer.exe /select,"' path '"')
        return
    }
    SplitPath(path, , &dir)
    if dir != "" && DirExist(dir)
        Run('explorer.exe "' dir '"')
    else
        MsgBox("File location not found:`n" path, "AutoUpdate")
}

; ═══════════════════════════════════════════════════════════════════════════
; Core update loop
; ═══════════════════════════════════════════════════════════════════════════

CheckForUpdates() {
    global LastCheckTime, SelfUpdatePending, CountdownSeconds, POLL_INTERVAL
    global LastCheckLabel, IsChecking, TARGETS, LastStatus
    global RateLimitResetAt, BackoffUntil

    IsChecking := true
    LastCheckTime := FormatTime(, "yyyy-MM-dd hh:mm:ss tt")
    LastCheckLabel.Text := "Last check: " LastCheckTime

    ; Global rate-limit backoff — if GitHub told us to wait, skip this cycle.
    if RateLimitResetAt > 0 && A_TickCount < RateLimitResetAt {
        secsLeft := (RateLimitResetAt - A_TickCount) // 1000
        Log("Global rate-limit backoff: " secsLeft "s remaining")
        IsChecking := false
        CountdownSeconds := POLL_INTERVAL // 1000
        return
    }

    ; Re-fetch the manifest and rebuild non-self TARGETS before iterating.
    ; This is what makes new manifest entries (and intent promotions / Edit
    ; Path edits) visible within one poll cycle without a script reload.
    RebuildTargetsFromManifest()

    selfTarget := ""
    selfIndex  := 0
    idx := 0
    for target in TARGETS {
        idx++
        if target.HasOwnProp("unconfigured") && target.unconfigured {
            UpdateGuiRow(idx, "—", "—", "⚠ click Edit Path…")
            continue
        }
        if !target.enabled {
            UpdateGuiRow(idx, "—", "—", "disabled")
            continue
        }
        ; Per-target backoff — if this target is in a backoff window, skip it.
        if BackoffUntil.Has(target.name) && A_TickCount < BackoffUntil[target.name] {
            UpdateGuiRow(idx, "—", "—", "backoff…")
            continue
        }

        remoteVer := FetchRemoteVersionFile(target.versionFile)
        localVer  := ReadLocalVersionFile(target.versionFile)
        if remoteVer = "" {
            RegisterFailure(target.name)
            UpdateGuiRow(idx, localVer, "?", "✗ ver err")
            LastStatus[target.name] := "Error: could not fetch version file"
            continue
        }
        if localVer = remoteVer {
            ClearFailure(target.name)
            UpdateGuiRow(idx, localVer, remoteVer, "✓ current")
            LastStatus[target.name] := localVer " — up to date"
            continue
        }
        ; Version mismatch → process self last (Reload terminates execution).
        if target.isSelf {
            selfTarget := target
            selfIndex  := idx
            continue
        }
        UpdateOneTarget(target, idx, localVer, remoteVer)
    }

    ; Self-update happens at the end — Reload() re-executes the script.
    if selfTarget != "" {
        remoteVer := FetchRemoteVersionFile(selfTarget.versionFile)
        localVer  := ReadLocalVersionFile(selfTarget.versionFile)
        if remoteVer != "" && localVer != remoteVer {
            UpdateOneTarget(selfTarget, selfIndex, localVer, remoteVer)
        }
        if SelfUpdatePending {
            WriteLocalVersionFile(selfTarget.versionFile, remoteVer)
            Log("Self-update complete; reloading")
            Reload()
        }
    }

    IsChecking := false
    CountdownSeconds := POLL_INTERVAL // 1000
}

UpdateOneTarget(target, rowIndex, localVersion, remoteVersion) {
    global LastStatus, SelfUpdatePending
    UpdateGuiRow(rowIndex, localVersion, remoteVersion, "↓ fetching")
    Log(target.name ": " localVersion " → " remoteVersion " (fetching)")

    remoteContent := FetchRemoteContent(target.remotePath)
    if remoteContent = "" {
        RegisterFailure(target.name)
        LastStatus[target.name] := "Error: failed to fetch full file"
        UpdateGuiRow(rowIndex, localVersion, remoteVersion, "✗ fetch err")
        return
    }
    if !WriteTargetFile(target, remoteContent) {
        RegisterFailure(target.name)
        LastStatus[target.name] := "Error: write failed"
        UpdateGuiRow(rowIndex, localVersion, remoteVersion, "✗ write err")
        return
    }
    WriteLocalVersionFile(target.versionFile, remoteVersion)
    ClearFailure(target.name)
    LastStatus[target.name] := localVersion " → " remoteVersion " — updated"
    UpdateGuiRow(rowIndex, remoteVersion, remoteVersion, "↑ updated")
    Log(target.name ": updated to " remoteVersion)
    TrayTip("Updated: " target.name,
        "AutoUpdate: " localVersion " → " remoteVersion, "Mute")

    if target.isSelf
        SelfUpdatePending := true
    else if target.HasOwnProp("reloadSignal") && target.reloadSignal
        NotifyRunningInstances(target.targetPath)
}

RegisterFailure(name) {
    global FailureCounts, BackoffUntil
    count := FailureCounts.Has(name) ? FailureCounts[name] + 1 : 1
    FailureCounts[name] := count
    ; Exponential backoff: 15s, 30s, 60s, 120s, 300s (5m cap).
    backoffs := [15000, 30000, 60000, 120000, 300000]
    delay := backoffs[Min(count, backoffs.Length)]
    BackoffUntil[name] := A_TickCount + delay
    Log("Failure #" count " for " name "; backoff " (delay // 1000) "s")
    if count = 3 {
        TrayTip("AutoUpdate error",
            name " has failed 3 consecutive polls. Check the log.", "Mute")
    }
}

ClearFailure(name) {
    global FailureCounts, BackoffUntil
    if FailureCounts.Has(name) {
        FailureCounts.Delete(name)
        BackoffUntil.Delete(name)
    }
}

; ═══════════════════════════════════════════════════════════════════════════
; Version file I/O (pipe-delimited |vXX.XX*|)
; ═══════════════════════════════════════════════════════════════════════════

ReadLocalVersionFile(versionFilePath) {
    localPath := A_ScriptDir "\" StrReplace(versionFilePath, "/", "\")
    if !FileExist(localPath)
        return "—"
    try {
        content := Trim(FileRead(localPath), " `t`r`n")
        return StrReplace(content, "|", "")
    }
    return "—"
}

WriteLocalVersionFile(versionFilePath, version) {
    localPath := A_ScriptDir "\" StrReplace(versionFilePath, "/", "\")
    SplitPath(localPath, , &dir)
    if !DirExist(dir)
        DirCreate(dir)
    WriteFileUtf8(localPath, "|" version "|")
}

WriteFileUtf8(path, content) {
    try {
        f := FileOpen(path, "w", "UTF-8")
        f.Write(content)
        f.Close()
        return true
    } catch as err {
        Log("WriteFileUtf8 failed for " path ": " err.Message)
        return false
    }
}

; ═══════════════════════════════════════════════════════════════════════════
; GitHub fetching (GitHub Pages for version files; API for full content)
; ═══════════════════════════════════════════════════════════════════════════

FetchRemoteVersionFile(versionFilePath) {
    global PAGES_BASE, VERSION
    url := PAGES_BASE versionFilePath "?t=" A_TickCount
    try {
        req := ComObject("WinHttp.WinHttpRequest.5.1")
        req.Open("GET", url, false)
        req.SetRequestHeader("User-Agent", "LAIS-AutoUpdate/" VERSION)
        req.Send()
        if req.Status = 200 {
            content := Trim(req.ResponseText, " `t`r`n")
            return StrReplace(content, "|", "")
        }
        Log("Pages GET " versionFilePath " returned HTTP " req.Status)
        return ""
    } catch as err {
        Log("Pages GET " versionFilePath " failed: " err.Message)
        return ""
    }
}

FetchRemoteContent(remotePath) {
    global API_BASE, GITHUB_BRANCH, GITHUB_TOKEN, VERSION, RateLimitResetAt
    url := API_BASE "/contents/" UriEncode(remotePath)
         . "?ref=" GITHUB_BRANCH "&t=" A_TickCount
    try {
        req := ComObject("WinHttp.WinHttpRequest.5.1")
        req.Open("GET", url, false)
        req.SetRequestHeader("Accept", "application/vnd.github.v3.raw")
        req.SetRequestHeader("User-Agent", "LAIS-AutoUpdate/" VERSION)
        if GITHUB_TOKEN != ""
            req.SetRequestHeader("Authorization", "token " GITHUB_TOKEN)
        req.Send()
        if req.Status = 200
            return req.ResponseText
        if req.Status = 403 {
            ; Check rate-limit headers to back off globally.
            try {
                remaining := req.GetResponseHeader("X-RateLimit-Remaining")
                resetEpoch := req.GetResponseHeader("X-RateLimit-Reset")
                if remaining = "0" && resetEpoch != "" {
                    epochNow := DateDiff(FormatTime(, "yyyyMMddHHmmss"),
                                         "19700101000000", "Seconds")
                    waitSecs := Max(60, Integer(resetEpoch) - epochNow)
                    RateLimitResetAt := A_TickCount + (waitSecs * 1000)
                    Log("Rate limited — backing off " waitSecs "s")
                    TrayTip("Rate limited",
                        "AutoUpdate: GitHub rate-limit hit; backing off "
                        . waitSecs "s. Confirm PAT is configured.", "Mute")
                }
            }
            return ""
        }
        if req.Status = 401 || req.Status = 404 {
            Log("API GET " remotePath " returned HTTP " req.Status
                . " (token missing/invalid or path not on branch)")
            return ""
        }
        Log("API GET " remotePath " returned HTTP " req.Status)
        return ""
    } catch as err {
        Log("API GET " remotePath " failed: " err.Message)
        return ""
    }
}

; ═══════════════════════════════════════════════════════════════════════════
; File writing & reload signalling
; ═══════════════════════════════════════════════════════════════════════════

WriteTargetFile(target, newContent) {
    ; Direct write first; on lock failure, stage via *.new + FileMove retry.
    try {
        f := FileOpen(target.targetPath, "w", "UTF-8")
        if f {
            f.Write(newContent)
            f.Close()
            return true
        }
    }
    ; Fallback: stage then atomically move (handles jboss/IIS file locks).
    stagePath := target.targetPath ".new"
    try {
        sf := FileOpen(stagePath, "w", "UTF-8")
        sf.Write(newContent)
        sf.Close()
    } catch as err {
        Log("Stage write failed for " target.targetPath ": " err.Message)
        return false
    }
    ; Retry FileMove for up to 60s in case the target is briefly locked.
    deadline := A_TickCount + 60000
    loop {
        try {
            FileMove(stagePath, target.targetPath, true)
            return true
        } catch {
            if A_TickCount >= deadline {
                Log("FileMove retry deadline hit for " target.targetPath)
                return false
            }
            Sleep(2000)
        }
    }
}

NotifyRunningInstances(targetPath) {
    global WM_AHK_RELOAD
    SplitPath(targetPath, &scriptName)
    try {
        prevDetect := A_DetectHiddenWindows
        DetectHiddenWindows(true)
        for hwnd in WinGetList(scriptName)
            PostMessage(WM_AHK_RELOAD, 0, 0, , "ahk_id " hwnd)
        DetectHiddenWindows(prevDetect)
    }
}

; ═══════════════════════════════════════════════════════════════════════════
; Logging — rolling in-memory buffer + persistent log file
; ═══════════════════════════════════════════════════════════════════════════

LogDir() {
    return A_AppData "\..\Local\LAIS-AutoUpdate"
}

LogFilePath() {
    return LogDir() "\autoupdate.log"
}

EnsureLogDir() {
    dir := LogDir()
    if !DirExist(dir)
        DirCreate(dir)
}

Log(message) {
    global LogBuffer, LogMaxLines, LogBox
    ts := FormatTime(, "yyyy-MM-dd HH:mm:ss")
    line := "[" ts "] " message
    LogBuffer.Push(line)
    while LogBuffer.Length > LogMaxLines
        LogBuffer.RemoveAt(1)
    try {
        f := FileOpen(LogFilePath(), "a", "UTF-8")
        if f {
            f.WriteLine(line)
            f.Close()
        }
    }
    ; Refresh GUI log box if it exists; auto-scroll to bottom.
    try {
        if IsSet(LogBox) && LogBox {
            LogBox.Value := JoinLogLines()
            SendMessage(0x0115, 7, 0, , "ahk_id " LogBox.Hwnd)  ; WM_VSCROLL, SB_BOTTOM
        }
    }
}

JoinLogLines() {
    global LogBuffer
    out := ""
    for line in LogBuffer
        out .= (out = "" ? "" : "`r`n") line
    return out
}

OpenLogFile() {
    path := LogFilePath()
    if FileExist(path)
        Run('notepad.exe "' path '"')
    else
        MsgBox("Log file does not exist yet:`n" path, "AutoUpdate")
}

; ═══════════════════════════════════════════════════════════════════════════
; Config loading — GITHUB_TOKEN read from AutoUpdate.config.ini (gitignored)
; ═══════════════════════════════════════════════════════════════════════════

LoadConfig() {
    global GITHUB_TOKEN
    configPath := A_ScriptDir "\AutoUpdate.config.ini"
    if !FileExist(configPath)
        return   ; Token stays empty; public repo fetches still work with rate limits.
    try {
        token := IniRead(configPath, "github", "token", "")
        if token != "" && token != "github_pat_REPLACE_WITH_YOUR_TOKEN"
            GITHUB_TOKEN := token
    } catch as err {
        ; Non-fatal — surface in log only.
        try Log("LoadConfig: IniRead failed: " err.Message)
    }
}

; ═══════════════════════════════════════════════════════════════════════════
; Manual Targets section — pre-handoff intent capture for Claude.
; The right column is a disposable wishlist of AHK scripts the developer
; wants Claude to add to the auto-updater. Each "intent" is a (Name, What
; it does, Local Folder) triple persisted to AutoUpdate.manual-targets.ini
; under [intent:Name] sections. Click "Copy for Claude" to assemble a
; self-contained handoff prompt; paste into a fresh Claude session, and
; Claude creates the .ahk file, adds the CI version-file step, and appends
; a [target:Name] section to autoHotkey/auto-update-targets.ini (the
; repo-tracked manifest).
; Once Claude integrates, AutoUpdate's next poll picks up the new manifest
; entry. LoadManifestTargets sees the matching intent, "promotes" the
; intent's Local Folder into a [localpath:Name] section in
; AutoUpdate.localpaths.ini (the per-machine persisted path store), and
; deletes the intent from this wishlist on the spot. The wishlist on the
; right is therefore always a pure pending queue — anything still listed
; here is still waiting on Claude. Removing items from the wishlist is
; safe by design (the localpath survives independently).
; To change the local folder of an already-integrated target, click
; "Edit Path…" on the left status table.
; ═══════════════════════════════════════════════════════════════════════════

BuildManualTargetsSection(g) {
    global IntentLV, IntentNameEdit, IntentFolderEdit, IntentDescriptionEdit,
           COL_W, RIGHT_COL_X

    ; The first control uses an absolute X (RIGHT_COL_X) and ym (top margin)
    ; so the right column starts at the same Y as the left column's countdown
    ; label. `Section` on this control means every subsequent `xs` anchors to
    ; RIGHT_COL_X — that's how every label, edit, and button below stays in
    ; the right column without restating the X coordinate.
    g.SetFont("s10 bold", "Segoe UI")
    g.AddText("x" RIGHT_COL_X " ym w" COL_W " c89B4FA Section",
        "─── Manual Targets — AHK Wishlist for Claude ───")

    g.SetFont("s9 bold", "Segoe UI")
    g.AddText("xs w" COL_W " cCDD6F4", "What this is")
    g.SetFont("s9 norm", "Segoe UI")
    g.AddText("xs w" COL_W " c89B4FA",
        "A wishlist of AHK scripts you want Claude to add to the auto-updater. "
        . "Add a Name + Local Folder + description, click `"Copy for Claude`", paste into a fresh Claude session.")

    g.SetFont("s9 bold", "Segoe UI")
    g.AddText("xs w" COL_W " cCDD6F4", "Workflow")
    g.SetFont("s9 norm", "Segoe UI")
    g.AddText("xs w" COL_W " c89B4FA",
        "1. Browse to the folder where the new script should land on this machine.")
    g.AddText("xs w" COL_W " c89B4FA",
        "2. Give it a Name and describe what it should do.")
    g.AddText("xs w" COL_W " c89B4FA",
        "3. Click `"Copy for Claude`" — clipboard now has full handoff instructions.")
    g.AddText("xs w" COL_W " c89B4FA",
        "4. Paste into a fresh Claude session. After integration merges, this AutoUpdate auto-installs it.")

    g.SetFont("s9 norm", "Consolas")
    IntentLV := g.AddListView(
        "xs w" COL_W " h130 -Multi Background313244 cCDD6F4",
        ["Name", "Local Folder", "What it does"])
    ; Column widths sum to 600 to fit comfortably inside w620 (LV chrome eats
    ; ~16-20px of internal width). Description column shows a truncated
    ; preview; the full text is read from INI on row select.
    IntentLV.ModifyCol(1, 130)
    IntentLV.ModifyCol(2, 200)
    IntentLV.ModifyCol(3, 270)
    IntentLV.OnEvent("ItemSelect", (*) => OnIntentSelect())

    ; Form fields. Per-row Y mechanic: `yp-3` on the edit field nudges it up
    ; 3px to vertically center with the label baseline. Subsequent same-row
    ; controls use plain `yp x+5` to inherit the corrected Y (don't stack
    ; yp-3 — that's the cumulative drift bug fixed in v01.09a).
    g.SetFont("s9 norm", "Segoe UI")

    g.AddText("xs w100 cCDD6F4", "Name:")
    IntentNameEdit := g.AddEdit("yp-3 x+5 w515 Background313244 cCDD6F4", "")

    g.AddText("xs w100 cCDD6F4", "Local Folder:")
    IntentFolderEdit := g.AddEdit("yp-3 x+5 w430 Background313244 cCDD6F4", "")
    BtnPickFolder := g.AddButton("yp x+5 w80", "📁 Browse")
    BtnPickFolder.OnEvent("Click", (*) => OnPickLocalFolder())

    g.AddText("xs w100 cCDD6F4", "What it does:")
    IntentDescriptionEdit := g.AddEdit(
        "yp-3 x+5 w515 h60 Multi WantTab Background313244 cCDD6F4", "")

    ; Buttons row. `xs Section` puts the row at RIGHT_COL_X (same anchor as
    ; the rest of the column) AND establishes a new section anchor so the
    ; subsequent `ys` calls correctly chain to BtnAdd's Y, not back to the
    ; left column's BtnCheckNow Section.
    BtnAdd := g.AddButton("xs Section w110", "Add")
    BtnAdd.OnEvent("Click", (*) => OnIntentAdd())
    BtnUpd := g.AddButton("ys x+5 w140", "Update Selected")
    BtnUpd.OnEvent("Click", (*) => OnIntentUpdate())
    BtnRem := g.AddButton("ys x+5 w140", "Remove Selected")
    BtnRem.OnEvent("Click", (*) => OnIntentRemove())
    BtnCopy := g.AddButton("ys x+5 w140", "Copy for Claude")
    BtnCopy.OnEvent("Click", (*) => CopyManualTargetsForClaude())

    RefreshIntentList()
}

; ─── Picker handlers ──────────────────────────────────────────────────────

; Pick a folder for the new script's local destination. Opens at the field's
; current value (per-intent memory) when set, otherwise the user's Desktop.
; The folder picker shows a "New Folder" button for one-click creation.
OnPickLocalFolder() {
    global IntentFolderEdit
    current := Trim(IntentFolderEdit.Value)
    initialDir := current != "" ? current : A_Desktop
    folder := DirSelect("*" initialDir, 3,
        "Pick the folder where the new script should land")
    if folder = ""
        return
    IntentFolderEdit.Value := folder
}

RefreshIntentList() {
    global IntentLV
    if !IsSet(IntentLV) || !IsObject(IntentLV)
        return
    ; Wishlist is now a pure pending queue — integrated intents get auto-
    ; promoted into AutoUpdate.localpaths.ini and deleted from the intent
    ; INI on the spot (see LoadManifestTargets). No status prefix needed.
    IntentLV.Delete()
    for intent in GetIntents() {
        ; Description preview: collapse newlines, truncate to ~50 chars.
        preview := StrReplace(StrReplace(intent.description, "`r`n", " "), "`n", " ")
        if StrLen(preview) > 50
            preview := SubStr(preview, 1, 47) "..."
        IntentLV.Add("", intent.name, intent.localFolder, preview)
    }
}

OnIntentSelect() {
    global IntentLV, IntentNameEdit, IntentFolderEdit, IntentDescriptionEdit
    row := IntentLV.GetNext(0)
    if row = 0
        return
    name := IntentLV.GetText(row, 1)
    ; Pull the full record from INI — the LV's column 3 is a truncated
    ; preview, but the form needs the full description.
    for intent in GetIntents() {
        if intent.name = name {
            IntentNameEdit.Value        := intent.name
            IntentFolderEdit.Value      := intent.localFolder
            IntentDescriptionEdit.Value := intent.description
            return
        }
    }
}

OnIntentAdd() {
    global IntentNameEdit, IntentFolderEdit, IntentDescriptionEdit
    name := Trim(IntentNameEdit.Value)
    if name = "" {
        MsgBox("Name is required.", "Manual Targets", 48)
        return
    }
    ; Disallow duplicate names among existing intents.
    for intent in GetIntents() {
        if intent.name = name {
            MsgBox("An intent named `"" name "`" already exists.",
                "Manual Targets", 48)
            return
        }
    }
    WriteIntentSection(name,
        Trim(IntentDescriptionEdit.Value),
        Trim(IntentFolderEdit.Value))
    Log("Intent added: " name)
    RefreshIntentList()
    ClearIntentForm()
}

OnIntentUpdate() {
    global IntentLV, IntentNameEdit, IntentFolderEdit, IntentDescriptionEdit
    row := IntentLV.GetNext(0)
    if row = 0 {
        MsgBox("Select a row to update.", "Manual Targets", 48)
        return
    }
    origName := IntentLV.GetText(row, 1)
    newName  := Trim(IntentNameEdit.Value)
    if newName = "" {
        MsgBox("Name is required.", "Manual Targets", 48)
        return
    }
    ; Rename → delete old section + write new.
    if newName != origName
        DeleteIntentSection(origName)
    WriteIntentSection(newName,
        Trim(IntentDescriptionEdit.Value),
        Trim(IntentFolderEdit.Value))
    Log("Intent updated: " origName
        . (newName != origName ? " → " newName : ""))
    RefreshIntentList()
}

OnIntentRemove() {
    global IntentLV
    row := IntentLV.GetNext(0)
    if row = 0 {
        MsgBox("Select a row to remove.", "Manual Targets", 48)
        return
    }
    name := IntentLV.GetText(row, 1)
    if MsgBox("Remove intent `"" name "`"?", "Manual Targets", 52) != "Yes"
        return
    DeleteIntentSection(name)
    Log("Intent removed: " name)
    RefreshIntentList()
    ClearIntentForm()
}

ClearIntentForm() {
    global IntentNameEdit, IntentFolderEdit, IntentDescriptionEdit
    IntentNameEdit.Value        := ""
    IntentFolderEdit.Value      := ""
    IntentDescriptionEdit.Value := ""
}

; ═══════════════════════════════════════════════════════════════════════════
; Copy for Claude — assembles a self-contained handoff prompt the developer
; can paste into a fresh Claude session to request integration of pending
; intents into the official TARGETS list (and creation of the .ahk files).
; ═══════════════════════════════════════════════════════════════════════════

CopyManualTargetsForClaude() {
    global GITHUB_OWNER, GITHUB_REPO
    intents := GetIntents()
    if intents.Length = 0 {
        MsgBox("No intents to copy. Add at least one above.",
            "Copy for Claude", 48)
        return
    }
    ts := FormatTime(, "yyyy-MM-dd HH:mm:ss") " on " A_ComputerName
    out := "Please add these new AutoHotkey scripts to the auto-updater in the "
        .  GITHUB_OWNER "/" GITHUB_REPO " repo. For each one, do the following:`r`n`r`n"
        .  "  1. Create the .ahk file at autoHotkey/<filename>.ahk implementing "
        .     "the described behavior. Include `#Requires AutoHotkey v2.0`, "
        .     "`#SingleInstance Force`, a VERSION constant (`"v01.00a`"), and "
        .     "`#Include ReloadHandler.ahk` so AutoUpdate's reload signal works.`r`n"
        .  "  2. Add a CI step in .github/workflows/auto-merge-claude.yml that "
        .     "regenerates live-site-pages/ahk-versions/<lower-filename>ahk.version.txt "
        .     "from the .ahk's VERSION constant on merge (mirror the existing "
        .     "`"Update AHK version files`" step pattern).`r`n"
        .  "  3. Append a [target:<Name>] section to autoHotkey/auto-update-targets.ini "
        .     "(the repo-tracked manifest of active auto-update targets). Use the exact "
        .     "INI snippet shown under each intent below. Do NOT edit InitTargets() in "
        .     "AutoUpdate.ahk — the manifest is data-driven; LoadManifestTargets() reads "
        .     "this INI at startup and joins each entry against the developer's local "
        .     "[intent:<Name>] section to derive the per-machine target path.`r`n"
        .  "  4. Add a per-script changelog at "
        .     "live-site-pages/ahk-changelogs/<lower-filename>ahk.changelog.md "
        .     "with a v01.00a Initial section.`r`n"
        .  "  5. Bump versions per the Pre-Commit checklist and commit.`r`n`r`n"
        .  "These intents were captured on " ts ".`r`n"
        .  "-----------------------------------------------------------`r`n"
    i := 0
    for intent in intents {
        i++
        ; Strip a trailing .ahk (case-insensitive) before constructing the
        ; filename and version-file basename, so an intent named either
        ; "MyScript" or "MyScript.ahk" produces the same clean artifacts:
        ; filename "MyScript.ahk", versionFile "myscriptahk.version.txt".
        ; The [target:<Name>] section name keeps the user-entered intent
        ; name verbatim — it's the join key with [intent:<Name>] and
        ; [localpath:<Name>], so consistency across the three is what
        ; matters, not whether the suffix is present. Lower-cased basename
        ; for the version-file path; defensive fallback if RegExReplace
        ; would yield empty (Name form validation should prevent that, but
        ; the handoff shouldn't crash on weird input).
        base := RegExReplace(intent.name, "i)\.ahk$", "")
        if base = ""
            base := intent.name
        lower := RegExReplace(StrLower(base), "[^a-z0-9-]", "")
        if lower = ""
            lower := StrLower(base)
        out .= "`r`nIntent " i ":`r`n"
            .  "  Name:           " intent.name        "`r`n"
            .  "  Filename:       " base ".ahk (suggested — adjust if needed)`r`n"
            .  "  Local folder:   " intent.localFolder "`r`n"
            .  "  What it does:`r`n"
        ; Indent each description line by 4 spaces for handoff readability.
        for line in StrSplit(intent.description, "`n", "`r")
            out .= "    " line "`r`n"
        ; Manifest snippet — paste-ready INI section for step 3.
        out .= "`r`n  Manifest entry (paste into autoHotkey/auto-update-targets.ini):`r`n"
            .  "    [target:" intent.name "]`r`n"
            .  "    filename=" base ".ahk`r`n"
            .  "    remotePath=autoHotkey/" base ".ahk`r`n"
            .  "    versionFile=ahk-versions/" lower "ahk.version.txt`r`n"
            .  "    reloadSignal=true`r`n"
            .  "    enabled=true`r`n"
    }
    out .= "`r`n-----------------------------------------------------------`r`n"
    A_Clipboard := out
    Log("Copied " intents.Length " intent(s) to clipboard for Claude handoff")
    TrayTip("Copied to clipboard",
        intents.Length " intent(s) ready for Claude handoff.", "Mute")
}

; ═══════════════════════════════════════════════════════════════════════════
; Utility
; ═══════════════════════════════════════════════════════════════════════════

UriEncode(str) {
    encoded := ""
    loop parse, str {
        c := A_LoopField
        if RegExMatch(c, "[A-Za-z0-9\-_.~/]")
            encoded .= c
        else
            encoded .= "%" Format("{:02X}", Ord(c))
    }
    return encoded
}

; Developed by: LightAISolutions
