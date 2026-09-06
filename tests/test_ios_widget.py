"""Exercise the widget's real Swift implementation with Release optimization."""

from pathlib import Path
import shutil
import subprocess
import sys

import pytest


ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.skipif(
    sys.platform != "darwin" or shutil.which("xcrun") is None,
    reason="Native widget regression tests require macOS and Xcode",
)
def test_widget_release_fetch_and_pagination(tmp_path):
    # Compile in one file so the harness can exercise private loader helpers without
    # changing their production visibility or maintaining a copy of their logic.
    source = ROOT / "frontend/ios/Hue2Widget/Hue2Widget.swift"
    harness = ROOT / "tests/ios/WidgetRegressionTests.swift"
    combined = tmp_path / "WidgetRegression.swift"
    combined.write_text(source.read_text() + "\n" + harness.read_text())
    executable = tmp_path / "widget-regression"
    compiled = subprocess.run(
        [
            "xcrun",
            "swiftc",
            "-O",
            "-whole-module-optimization",
            "-swift-version",
            "5",
            "-parse-as-library",
            "-module-cache-path",
            str(tmp_path / "modules"),
            str(combined),
            "-o",
            str(executable),
        ],
        capture_output=True,
        text=True,
        timeout=180,
    )
    assert compiled.returncode == 0, compiled.stdout + compiled.stderr
    result = subprocess.run([str(executable)], capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "Widget Release regressions passed" in result.stdout
