; ReloadHandler.ahk — Optional #Include for AHK project scripts
; Enables auto-reload when the admin's AutoUpdate.ahk pushes a new version
; to the network share. AutoUpdate sends a PostMessage; this handler receives
; it and calls Reload() so the script re-reads the updated file from disk.
;
; Usage (add to your project script after #SingleInstance Force):
;   #Include ReloadHandler.ahk
;   InitReloadHandler()

InitReloadHandler() {
    OnMessage(0x0500, _OnReloadMessage)  ; WM_USER + 256 = 0x0500
}

_OnReloadMessage(wParam, lParam, msg, hwnd) {
    ; Slight delay lets message processing finish before restarting
    SetTimer(() => Reload(), -100)
    return 0
}

; Developed by: LightAISolutions
