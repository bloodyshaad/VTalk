#![allow(dead_code)]

pub mod auth {
    pub const SESSION_STORE: &str = "session.dat";
    pub const SESSION_KEY: &str = "jwt";
}

pub mod window {
    pub const MAIN_WINDOW: &str = "main";
}

pub mod app {
    pub const NAME: &str = "VTalk";
    pub const VERSION: &str = env!("CARGO_PKG_VERSION");
}
