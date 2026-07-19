// Prevents an *additional* console window on Windows in release, but we still
// attach to the parent terminal (if any) so logs/errors are visible when the
// app is launched from PowerShell/cmd. Double-clicking stays windowed.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(windows)]
fn attach_parent_console() {
    use std::os::windows::io::FromRawHandle;
    // SAFETY: AttachConsole is safe to call; failures are ignored (no parent).
    unsafe {
        #[link(name = "kernel32")]
        extern "system" {
            fn AttachConsole(dw_process_id: u32) -> i32;
            fn GetStdHandle(n_std_handle: i32) -> *mut std::ffi::c_void;
        }
        const ATTACH_PARENT_PROCESS: u32 = 0xFFFF_FFFF;
        const STD_OUTPUT_HANDLE: i32 = -11;
        const STD_ERROR_HANDLE: i32 = -12;
        if AttachConsole(ATTACH_PARENT_PROCESS) != 0 {
            let out = GetStdHandle(STD_OUTPUT_HANDLE);
            let err = GetStdHandle(STD_ERROR_HANDLE);
            if !out.is_null() {
                let f = std::fs::File::from_raw_handle(out as _);
                std::mem::forget(f);
            }
            if !err.is_null() {
                let f = std::fs::File::from_raw_handle(err as _);
                std::mem::forget(f);
            }
        }
    }
}

fn main() {
    #[cfg(windows)]
    attach_parent_console();
    vtalk_lib::run()
}
