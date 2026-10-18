{ config, lib, pkgs, ... }:
let cfg = config.services.passless;
in {
  options.services.passless = {
    enable = lib.mkEnableOption "Passless host support for explicitly named users";
    package = lib.mkOption {
      type = lib.types.package;
      default = pkgs.callPackage ./package.nix { };
      description = "Passless package installed on the host.";
    };
    users = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [ ];
      example = [ "alice" ];
      description = "Existing users allowed to create virtual HID devices through /dev/uhid.";
    };
  };
  config = lib.mkIf cfg.enable {
    assertions = map (user: {
      assertion = builtins.hasAttr user config.users.users && config.users.users.${user}.isNormalUser;
      message = "services.passless.users must name an existing normal user: ${user}";
    }) cfg.users;
    environment.systemPackages = [ cfg.package ];
    boot.kernelModules = [ "uhid" ];
    users.groups.passless.members = cfg.users;
    services.udev.extraRules = ''
      KERNEL=="uhid", GROUP="passless", MODE="0660"
      SUBSYSTEM=="hidraw", KERNELS=="0003:15D9:0A37.*", TAG+="uaccess"
      SUBSYSTEM=="hidraw", KERNELS=="0003:1050:0402.*", TAG+="uaccess"
    '';
  };
}
