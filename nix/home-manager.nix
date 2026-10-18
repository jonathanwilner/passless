{ config, lib, pkgs, ... }:
let
  cfg = config.services.passless;
  toml = pkgs.formats.toml { };
in {
  options.services.passless = {
    enable = lib.mkEnableOption "Passless desktop authenticator";
    package = lib.mkOption {
      type = lib.types.package;
      default = pkgs.callPackage ./package.nix { };
      description = "Passless package.";
    };
    settings = lib.mkOption {
      type = toml.type;
      default = { };
      description = "Public TOML configuration. Never place credentials or private keys here: this file enters the Nix store.";
    };
  };
  config = lib.mkIf cfg.enable {
    assertions = [ {
      assertion = pkgs.stdenv.hostPlatform.isLinux;
      message = "Passless requires Linux UHID.";
    } ];
    home.packages = [ cfg.package ];
    services.passless.settings = {
      backend_type = lib.mkDefault "pass";
      pass = {
        store_path = lib.mkDefault "${config.home.homeDirectory}/.password-store";
        path = lib.mkDefault "fido2";
        gpg_backend = lib.mkDefault "gnupg-bin";
        git_sync = lib.mkDefault false;
      };
    };
    xdg.configFile."passless/config.toml".source = toml.generate "passless.toml" cfg.settings;
    systemd.user.services.passless = {
      Unit = {
        Description = "Passless FIDO2 software authenticator";
        Documentation = "https://github.com/pando85/passless";
        After = [ "graphical-session.target" ];
        ConditionPathExists = lib.mkIf (cfg.settings.backend_type == "pass") "${cfg.settings.pass.store_path}/.gpg-id";
        PartOf = [ "graphical-session.target" ];
      };
      Service = {
        ExecStart = "${lib.getExe cfg.package}";
        Environment = [ "PASSLESS_INTERACTION_MODE=desktop" ];
        Restart = "on-failure";
        RestartSec = 5;
        UMask = "0077";
        LimitCORE = 0;
        LimitMEMLOCK = "2M";
      };
      Install.WantedBy = [ "graphical-session.target" ];
    };
  };
}
