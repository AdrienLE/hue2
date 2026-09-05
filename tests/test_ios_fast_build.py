from datetime import datetime, timedelta
import importlib.util
import json
import os
from pathlib import Path
import plistlib
import subprocess

import pytest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("ios_fast_build", ROOT / "scripts/ios_fast_build.py")
build = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(build)
CONFIG = json.loads((ROOT / "frontend/ios-fast-build.json").read_text())


def profile(bundle_id="com.adrienle.hue2"):
    return {
        "UUID": "test-profile",
        "TeamIdentifier": ["TEAM"],
        "ExpirationDate": datetime.now() + timedelta(days=1),
        "ProvisionedDevices": ["test-device"],
        "Entitlements": {
            "application-identifier": f"TEAM.{bundle_id}",
            "get-task-allow": False,
            "com.apple.security.application-groups": ["group.com.adrienle.hue2"],
        },
    }


def test_profile_inheritance_and_explicit_api_override():
    eas = {
        "build": {
            "base": {"distribution": "internal", "env": {"EXPO_PUBLIC_ENVIRONMENT": "staging"}},
            "preview": {"extends": "base", "env": {"EXPO_PUBLIC_API_URL_STAGING": "https://old"}},
        }
    }
    selected = build.load_profile(eas, "preview")
    env = build.build_environment(selected, {"PATH": "/bin", "SKIP_BUNDLING": "1"}, "https://new")
    assert selected["distribution"] == "internal"
    assert env["EXPO_PUBLIC_API_URL_STAGING"] == "https://new"
    assert env["EXPO_PUBLIC_API_URL"] == "https://new"
    assert env["FORCE_BUNDLING"] == "1"
    assert env["EXPO_NO_DOTENV"] == "1"
    assert "SKIP_BUNDLING" not in env


def test_profile_inheritance_errors():
    with pytest.raises(build.BuildError, match="Unknown"):
        build.load_profile({"build": {}}, "missing")
    with pytest.raises(build.BuildError, match="Circular"):
        build.load_profile({"build": {"a": {"extends": "b"}, "b": {"extends": "a"}}}, "a")


def test_release_rejects_dev_auth_and_unsafe_profile_environment():
    with pytest.raises(build.BuildError, match="AUTH_OVERRIDE"):
        build.build_environment({}, {"EXPO_PUBLIC_AUTH_OVERRIDE_TOKEN": "test-token"})
    with pytest.raises(build.BuildError, match="only public"):
        build.build_environment({"env": {"PATH": "/other/bin"}}, {})


def test_requires_widget_credentials():
    with pytest.raises(build.BuildError, match="Hue2WidgetExtension"):
        build.credential_targets(
            {"ios": {"provisioningProfilePath": "main.mobileprovision"}}, CONFIG
        )
    credentials = {
        name: {"provisioningProfilePath": f"{name}.mobileprovision"} for name in CONFIG["targets"]
    }
    assert build.credential_targets({"ios": credentials}, CONFIG) == credentials


@pytest.mark.parametrize(
    "invalid", ["expired", "wrong_bundle", "development", "app_store", "group"]
)
def test_invalid_signing_profile_is_rejected(invalid):
    data = profile()
    if invalid == "expired":
        data["ExpirationDate"] = datetime.now() - timedelta(days=1)
    elif invalid == "wrong_bundle":
        data["Entitlements"]["application-identifier"] = "TEAM.some.other.app"
    elif invalid == "development":
        data["Entitlements"]["get-task-allow"] = True
    elif invalid == "app_store":
        data.pop("ProvisionedDevices")
    else:
        data["Entitlements"]["com.apple.security.application-groups"] = []
    with pytest.raises(build.BuildError):
        build.validate_profile(
            data,
            "com.adrienle.hue2",
            {"com.apple.security.application-groups": ["group.com.adrienle.hue2"]},
        )


def test_export_maps_both_profiles_by_bundle_id():
    credentials = {
        name: {"profile": {**profile(identifier), "UUID": name}}
        for name, identifier in CONFIG["targets"].items()
    }
    options = build.export_options(credentials, CONFIG, "certificate-hash")
    assert options["provisioningProfiles"] == {
        "com.adrienle.hue2": "Hue2",
        "com.adrienle.hue2.Hue2Widget": "Hue2WidgetExtension",
    }
    assert options["method"] == "release-testing"
    assert options["manageAppVersionAndBuildNumber"] is False


def test_archive_retains_cache_and_builds_all_scheme_targets(tmp_path):
    command = build.archive_command(tmp_path, tmp_path / "cache", CONFIG, build_number="123")
    assert "install" in command and "archive" not in command and "clean" not in command
    assert command[command.index("-scheme") + 1] == "Hue2"
    assert command[command.index("-derivedDataPath") + 1] == str(tmp_path / "cache/DerivedData")
    assert "CURRENT_PROJECT_VERSION=123" in command
    assert "generic/platform=iOS" in command
    assert command[command.index("-jobs") + 1] == "4"
    paths = build.native_paths(tmp_path / "cache", CONFIG)
    assert f"DSTROOT={paths['installed']}" in command
    assert f"OBJROOT={paths['objects']}" in command


def test_archive_packaging_preserves_build_cache(tmp_path, monkeypatch):
    paths = build.native_paths(tmp_path, CONFIG)
    app = paths["installed"] / "Applications/Hue2.app"
    app.mkdir(parents=True)
    (app / "Info.plist").write_bytes(
        plistlib.dumps(
            {
                "CFBundleIdentifier": "com.adrienle.hue2",
                "CFBundleExecutable": "Hue2",
                "CFBundleShortVersionString": "1.0",
                "CFBundleVersion": "123",
            }
        )
    )
    (app / "main.jsbundle").write_bytes(b"current JavaScript")
    objects = paths["objects"] / "cached.o"
    objects.parent.mkdir(parents=True)
    objects.write_bytes(b"compiled dependency")
    monkeypatch.setattr(build, "verify_bundles", lambda *_: app)

    def copy(command, **_):
        if command[0] == "lipo":
            return "arm64\n"
        if command[0] == "codesign":
            return "Authority=Apple Distribution: Test\n"
        build.shutil.copytree(command[1], command[2], dirs_exist_ok=True)

    monkeypatch.setattr(build, "run", copy)
    for credentials in (None, {"Hue2": {"profile": {"TeamIdentifier": ["TEAM"]}}}):
        archive = build.assemble_archive(tmp_path, CONFIG, credentials)
        assert (
            archive / "Products/Applications/Hue2.app/main.jsbundle"
        ).read_bytes() == b"current JavaScript"
        assert objects.read_bytes() == b"compiled dependency"
        assert app.is_dir()
        info = build.read_plist(archive / "Info.plist")
        assert info["ApplicationProperties"]["ApplicationPath"] == "Applications/Hue2.app"
        assert info["ApplicationProperties"]["CFBundleVersion"] == "123"
        assert info["ApplicationProperties"]["Architectures"] == ["arm64"]
        if credentials:
            assert info["ApplicationProperties"]["SigningIdentity"] == "Apple Distribution: Test"
            assert info["ApplicationProperties"]["Team"] == "TEAM"


def test_signed_archive_selects_each_targets_own_profile(tmp_path):
    credentials = {
        name: {"profile": {**profile(identifier), "UUID": f"profile-{name}"}}
        for name, identifier in CONFIG["targets"].items()
    }
    command = build.archive_command(
        tmp_path,
        tmp_path / "cache",
        CONFIG,
        signing=(credentials, "certificate-hash", tmp_path / "build.keychain-db"),
    )
    assert "PROVISIONING_PROFILE_SPECIFIER=$(FAST_PROFILE_$(TARGET_NAME))" in command
    for name in CONFIG["targets"]:
        assert f"FAST_PROFILE_{name}=profile-{name}" in command
    assert "CODE_SIGN_IDENTITY=certificate-hash" in command
    assert "DEVELOPMENT_TEAM=TEAM" in command
    assert "CODE_SIGNING_ALLOWED=NO" not in command


def test_export_requires_app_group_in_actual_signature():
    required = {"com.apple.security.application-groups": ["group.com.adrienle.hue2"]}
    with pytest.raises(build.BuildError, match="application-groups"):
        build.verify_signed_entitlements({}, required)
    with pytest.raises(build.BuildError, match="debugging"):
        build.verify_signed_entitlements({**required, "get-task-allow": True}, required)
    build.verify_signed_entitlements(required, required)


def test_bundle_verification_detects_missing_widget_and_js(tmp_path):
    app = tmp_path / "Hue2.app"
    app.mkdir()
    (app / "Info.plist").write_bytes(
        plistlib.dumps({"CFBundleIdentifier": "com.adrienle.hue2", "CFBundleVersion": "123"})
    )
    with pytest.raises(build.BuildError, match="JavaScript"):
        build.verify_bundles(tmp_path, CONFIG)
    (app / "main.jsbundle").write_bytes(b"bundled-js")
    with pytest.raises(build.BuildError, match="all extensions"):
        build.verify_bundles(tmp_path, CONFIG)
    widget = app / "PlugIns/Hue2WidgetExtension.appex"
    widget.mkdir(parents=True)
    (widget / "Info.plist").write_bytes(
        plistlib.dumps(
            {"CFBundleIdentifier": "com.adrienle.hue2.Hue2Widget", "CFBundleVersion": "123"}
        )
    )
    assert build.verify_bundles(tmp_path, CONFIG) == app


def test_keychain_cleanup_preserves_concurrent_additions(tmp_path, monkeypatch):
    calls = []
    der = b"test-certificate"
    identity = build.hashlib.sha1(der).hexdigest().upper()
    keychain = str(tmp_path / "build.keychain-db")
    keychains = ["/login.keychain-db"]

    def fake_run(command, **kwargs):
        nonlocal keychains
        calls.append(command)
        if command[1] == "list-keychains":
            if "-s" in command:
                keychains = command[command.index("-s") + 1 :]
            return "\n".join(json.dumps(path) for path in keychains)
        if command[1] == "find-identity":
            return f'1) {identity} "Apple Distribution"'
        return ""

    monkeypatch.setattr(build, "run", fake_run)
    credentials = {
        "app": {
            "certificate": tmp_path / "cert.p12",
            "password": "secret",
            "profile": {"DeveloperCertificates": [der]},
        }
    }
    with pytest.raises(RuntimeError, match="export failure"):
        with build.signing_keychain(credentials, tmp_path) as selected:
            assert selected == identity
            keychains.append("/other-build.keychain-db")
            raise RuntimeError("export failure")
    assert keychains == ["/login.keychain-db", "/other-build.keychain-db"]
    assert ["security", "delete-keychain", keychain] in calls


@pytest.mark.parametrize(
    "version, directory",
    [
        ("15.4", "Library/MobileDevice/Provisioning Profiles"),
        ("26.5", "Library/Developer/Xcode/UserData/Provisioning Profiles"),
    ],
)
def test_profile_installation_matches_xcode_and_preserves_existing_files(
    tmp_path, monkeypatch, version, directory
):
    monkeypatch.setattr(build.Path, "home", classmethod(lambda cls: tmp_path))
    monkeypatch.setattr(build, "run", lambda *_: f"Xcode {version}\n")
    source = tmp_path / "download.mobileprovision"
    source.write_bytes(b"profile contents")
    credentials = {"Hue2": {"profile": {"UUID": "test-profile"}, "profile_path": source}}
    build.install_profiles(credentials)
    installed = tmp_path / directory / "test-profile.mobileprovision"
    assert installed.read_bytes() == b"profile contents"
    assert installed.stat().st_mode & 0o777 == 0o600
    source.write_bytes(b"different profile")
    with pytest.raises(build.BuildError, match="same UUID"):
        build.install_profiles(credentials)
    assert installed.read_bytes() == b"profile contents"


@pytest.mark.parametrize("eas_fallback", [False, True])
def test_failed_build_does_not_upload_previous_ipa(tmp_path, eas_fallback):
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    helper = scripts / "build_and_upload_diawi.sh"
    helper.write_text((ROOT / "scripts/build_and_upload_diawi.sh").read_text())
    fast = scripts / "build-ios-ipa-fast.sh"
    fast.write_text("#!/bin/bash\nexit 23\n")
    fast.chmod(0o755)
    legacy = scripts / "build-prod.sh"
    legacy.write_text("#!/bin/bash\nexit 24\n")
    legacy.chmod(0o755)
    old_ipa = tmp_path / "frontend/builds/swoosh-ios-fast.ipa"
    old_ipa.parent.mkdir(parents=True)
    old_ipa.write_bytes(b"previous IPA")
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    curl = bin_dir / "curl"
    curl.write_text('#!/bin/bash\necho "UNEXPECTED UPLOAD"\nexit 99\n')
    curl.chmod(0o755)
    env = {**os.environ, "PATH": f"{bin_dir}:{os.environ['PATH']}", "DIAWI_TOKEN": "test-token"}
    command = ["bash", str(helper), "ios"]
    if eas_fallback:
        command.append("--eas-build")
    result = subprocess.run(command, env=env, capture_output=True, text=True)
    assert result.returncode == (24 if eas_fallback else 23), result.stdout + result.stderr
    assert "UNEXPECTED UPLOAD" not in result.stdout
    assert old_ipa.read_bytes() == b"previous IPA"
