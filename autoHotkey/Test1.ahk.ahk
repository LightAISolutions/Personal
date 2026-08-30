#Requires AutoHotkey v2.0
#SingleInstance Force
; ═══════════════════════════════════════════════════════════════════════════
; Test1.ahk.ahk — placeholder for verifying the AutoUpdate manifest+intent
; flow. The script is intentionally a no-op. Its only job is to prove that
; the pipeline (manifest entry → LoadManifestTargets → join with local
; intent → fetch via GitHub API → write to the developer's Local Folder)
; lands the file in the right place on the developer's machine.
; The script stays resident with a tray icon so the developer can SEE it
; running after AutoUpdate auto-pulls it; future versions hot-reload via
; the ReloadHandler message.
; ═══════════════════════════════════════════════════════════════════════════

VERSION := "v01.00a"

#Include ReloadHandler.ahk

InitReloadHandler()
Persistent()

A_IconTip := "Test1 " VERSION " — pipeline-test placeholder"

; Developed by: LightAISolutions
