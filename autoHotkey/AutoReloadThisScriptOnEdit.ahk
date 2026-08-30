CloseErrorWindows() {
    ; Close any windows with the current script name (.ahk) in the title, but skip Notepad windows
    try {
        ; Get all windows that match the script name
        windows := WinGetList(A_ScriptName)
        for hwnd in windows {
            title := WinGetTitle("ahk_id " . hwnd)
            ; Only close windows that don't contain "Notepad"
            if (!InStr(title, "Notepad")) {
                WinClose("ahk_id " . hwnd)
                Sleep(50) ; Small delay to allow window to close
            }
        }
    } catch Error as e {
        ; Handle any errors silently
    }
}

SetMatchingWindowsAlwaysOnTop() {
    ; Set windows that match script name (but not Notepad) to always on top
    try {
        ; Get all windows that match the script name
        windows := WinGetList(A_ScriptName)
        for hwnd in windows {
            title := WinGetTitle("ahk_id " . hwnd)
            ; Only set always on top for windows that don't contain "Notepad"
            if (!InStr(title, "Notepad")) {
                WinSetAlwaysOnTop(true, "ahk_id " . hwnd)
                Sleep(50) ; Small delay to allow window property to be set
            }
        }
    } catch Error as e {
        ; Handle any errors silently
    }
}

AutoReloadThisScriptOnEdit() {
    static lastMod := FileGetTime(A_ScriptFullPath, "M")
    static counter := 0
    static reloadAttempted := false
    
    ; Update counter and GUI
    counter++
    
    ; Check for file changes
    try {
        currentMod := FileGetTime(A_ScriptFullPath, "M")
        if (currentMod != lastMod && !reloadAttempted) {
            ; Update lastMod BEFORE attempting reload to prevent infinite loops
            lastMod := currentMod
            reloadAttempted := true
            
            ; Close any existing error windows before reloading
            CloseErrorWindows()
            
            ; Set matching windows to always on top after a brief delay
            SetTimer(() => SetMatchingWindowsAlwaysOnTop(), 500)
            
            ; Optional: Show a tooltip indicating reload attempt
            ToolTip("Reloading script...")
            SetTimer(() => ToolTip(), -2000)  ; Clear tooltip after 2 seconds
            
            ; Small delay to ensure file operations are complete
            Sleep(100)
            Reload
        }
        ; Reset reload attempted flag if file hasn't changed for a while
        else if (currentMod == lastMod && reloadAttempted) {
            reloadAttempted := false
        }
    } catch Error as e {
        ; Handle any file access errors
        ; Could log error or show message if needed
    }
}