{ config, lib, pkgs, ... }:
let
  cfg = config.services.passless;
  toml = pkgs.formats.toml { };
  environment = cfg.environment
    // lib.optionalAttrs (cfg.gnupgHome != null) { GNUPGHOME = cfg.gnupgHome; }
    // { PASSLESS_INTERACTION_MODE = "desktop"; PASSLESS_USB_IDENTITY = cfg.usbIdentity; };
  # systemd parses each Environment directive as words and expands % specifiers.
  quoteEnvironment = value: "\"" + lib.replaceStrings
    [ "\\" "\"" "\n" "\r" "\t" "%" ]
    [ "\\\\" "\\\"" "\\n" "\\r" "\\t" "%%" ] value + "\"";
  wrapperArgs = lib.escapeShellArgs (lib.concatLists (lib.mapAttrsToList (name: value: [ "--set" name value ]) environment));
  configuredPackage = pkgs.symlinkJoin {
    name = "passless-user";
    paths = [ cfg.package ];
    nativeBuildInputs = [ pkgs.makeWrapper ];
    postBuild = ''
      wrapProgram $out/bin/passless ${wrapperArgs}
      wrapProgram $out/bin/passless-git-sync ${wrapperArgs}
    '';
  };
in {
  options.services.passless = {
    enable = lib.mkEnableOption "Passless desktop authenticator";
    package = lib.mkOption {
      type = lib.types.package;
      default = pkgs.callPackage ./package.nix { };
      description = "Passless package.";
    };
    usbIdentity = lib.mkOption {
      type = lib.types.enum [ "passless" "yubikey-fido" ];
      default = "passless";
      description = "Host HID identity profile. yubikey-fido changes the USB VID/PID and name only; Passless AAGUID, attestation and confirmation remain unchanged.";
    };
    environment = lib.mkOption {
      type = lib.types.attrsOf lib.types.str;
      default = { };
      example = { GIT_SSH_COMMAND = "ssh -i /home/alice/.local/share/passless/store-sync -o IdentitiesOnly=yes -o BatchMode=yes"; };
      description = "Public environment shared by the CLI and service. Use absolute paths, not systemd specifiers. Desktop confirmation remains required.";
    };
    gnupgHome = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      example = "/home/alice/.local/share/passless/gnupg";
      description = "Dedicated GPG home for both the user service and Passless CLI. Existing keys must be provisioned separately.";
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
    home.packages = [ configuredPackage ];
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
        
        PartOf = [ "graphical-session.target" ];
      };
      Service = {
        ExecStart = "${configuredPackage}/bin/passless";
        # Match password-store's nearest recipient policy, including scoped stores.
        ExecCondition = lib.mkIf (cfg.settings.backend_type == "pass") (toString (pkgs.writeShellScript "passless-store-ready" ''
          store=${lib.escapeShellArg cfg.settings.pass.store_path}
          path=${lib.escapeShellArg "${cfg.settings.pass.store_path}/${cfg.settings.pass.path}"}
          while true; do
            [ ! -r "$path/.gpg-id" ] || exit 0
            [ "$path" != "$store" ] || exit 1
            parent=$(${pkgs.coreutils}/bin/dirname "$path")
            [ "$parent" != "$path" ] || exit 1
            path=$parent
          done
        ''));

        Environment = lib.mapAttrsToList (name: value: quoteEnvironment "${name}=${value}") environment;
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
