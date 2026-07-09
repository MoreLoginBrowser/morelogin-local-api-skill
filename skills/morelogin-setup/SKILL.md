---
name: morelogin-setup
description: Use when preparing, installing, updating, or verifying MoreLogin Client and MoreLogin CLI on macOS, Windows, or Linux. Resolves latest package URLs from MoreLogin release APIs, downloads matching CLI/client packages, opens or reveals installers, respects user-confirmation boundaries, and verifies MoreLogin can be used by an AI agent.
---

# MoreLogin Setup

## Goal

Prepare MoreLogin Client and MoreLogin CLI for the current machine.

The skill may download files, reveal or open installers, set executable permission on downloaded CLI binaries, and verify installation. It must not accept Terms of Services, EULA, UAC, Gatekeeper, administrator prompts, sudo prompts, privacy permissions, firewall prompts, or other security/user confirmations on behalf of the user.

## Platform Detection

Detect OS and architecture before downloading anything.

Normalize architectures:

- `arm64`, `aarch64` -> `arm64`
- `x86_64`, `amd64`, `x64` -> `x64`

Use these package identifiers:

| Platform | Arch | Client identify | CLI identify |
|---|---:|---|---|
| macOS | arm64 | `MoreLogin_AirDrop_darwin_arm64` | `MoreLogin_AirDrop_darwin_arm64_cli` |
| macOS | x64 | `MoreLogin_AirDrop_darwin_x64` | `MoreLogin_AirDrop_darwin_x64_cli` |
| Windows | x64 | `MoreLogin_AirDrop_window_x64` | `MoreLogin_AirDrop_window_x64_cli` |
| Linux | x64 | `MoreLogin_AirDrop_linux_x64` | `MoreLogin_AirDrop_linux_x64_cli` |

If the current OS/arch pair is not listed, stop and tell the user it is unsupported.

## Resolve Latest URLs

For both Client and CLI, request:

```text
https://cb-gateway.morelogin.com/app/ver/public/latest?identify=<identify>
```

Expected response:

```json
{
  "code": 0,
  "msg": null,
  "data": "https://releases.morelogin.com/...",
  "success": true
}
```

Rules:

- `success` must be `true`
- `code` must be `0`
- `data` must be a non-empty URL
- If any check fails, stop and show the raw response

Use `data` as the download URL.

## Download Location

Prefer a user-visible location:

- macOS: `~/Downloads`
- Windows: `%USERPROFILE%\Downloads`
- Linux: `~/Downloads`

If Downloads is unavailable, use the current workspace and tell the user the exact path.

Do not overwrite an existing file silently. If the file exists, either reuse it after confirming it matches the expected file, or download with a unique suffix.

If checksum metadata is unavailable, say that SHA256 verification cannot be performed.

## CLI Presence Check

Check whether CLI is globally available:

```text
ml-cli --help
```

If available, do not download CLI again. Continue to Client presence check.

If unavailable:

1. Resolve the current platform CLI URL.
2. Download the CLI package or binary.
3. Prepare it according to platform.
4. Verify with `--help`.
5. Use the downloaded CLI path for later verification if it is not installed globally.

Do not install CLI into system PATH without explicit user approval.

### macOS CLI

If the CLI URL points to a raw binary:

- Save as `ml-cli`
- Run `chmod +x <cli-path>`
- Verify with `<cli-path> --help`

Do not move to `/usr/local/bin` or `/opt/homebrew/bin` without user approval.

### Windows CLI

If the CLI URL points to an `.exe` or raw Windows executable:

- Save as `ml-cli.exe`
- Verify with PowerShell:

```powershell
& "$env:USERPROFILE\Downloads\ml-cli.exe" --help
```

Do not modify PATH or copy to system directories without user approval.

### Linux CLI

If the CLI URL points to a raw binary:

- Save as `ml-cli`
- Run `chmod +x <cli-path>`
- Verify with `<cli-path> --help`

Do not move to `/usr/local/bin`, `/usr/bin`, or other system locations without user approval.

## Client Presence Check

Before resolving or downloading the Client installer, check whether MoreLogin Client is already installed.

Do not use CLI presence as proof that Client is installed. MoreLogin CLI and MoreLogin Client are separate components.

### macOS Client Check

Check common app locations:

```text
/Applications/MoreLogin.app
~/Applications/MoreLogin.app
```

If found:

- Do not download the Client installer.
- Try launching with `open -a MoreLogin`.
- Continue to post-install verification.

### Windows Client Check

Check common install locations:

```text
%LOCALAPPDATA%\Programs\MoreLogin
%PROGRAMFILES%\MoreLogin
%PROGRAMFILES(X86)%\MoreLogin
```

Also check whether a MoreLogin executable is discoverable in those locations.

If found:

- Do not download the Client installer.
- Try launching the discovered executable or tell the user it is already installed.
- Continue to post-install verification.

### Linux Client Check

Check common executable/application locations:

```text
which morelogin
which MoreLogin
~/.local/bin
~/Applications
/opt
/usr/local/bin
/usr/bin
```

Also check common desktop entry locations:

```text
~/.local/share/applications
/usr/share/applications
```

If found:

- Do not download the Client installer.
- Try launching only if it does not require elevated privileges.
- Continue to post-install verification.

## Client Installer

Only resolve and download the Client installer if MoreLogin Client is not already installed, or if the user explicitly asks to reinstall/update.

Resolve and download the Client installer for the current platform, then handle it by platform.

## macOS Client Handling

Expected installer is usually `.dmg`.

Steps:

1. Download the DMG.
2. Run `open <dmg-path>` to try opening the installer.
3. Run `open -R <dmg-path>` to reveal it in Finder.
4. Check whether a MoreLogin volume appears under `/Volumes`.
5. If the DMG does not mount or the user cannot see the window:
   - Give the exact DMG path.
   - Tell the user to double-click it in Finder.
6. Do not run `hdiutil attach -agree`.
7. If Terms of Services, Gatekeeper, administrator, privacy, or network prompts appear, stop and ask the user to confirm manually.

After the user completes installation:

- Check `/Applications` for MoreLogin.
- Try `open -a MoreLogin`.

## Windows Client Handling

Expected installer is usually `.exe` or `.msi`.

Steps:

1. Download the installer.
2. Reveal it in Explorer:

```powershell
explorer.exe /select,"<installer-path>"
```

3. Open installer only if appropriate:

```powershell
Start-Process "<installer-path>"
```

4. If UAC, EULA, installer wizard, firewall, or privacy prompts appear:
   - Stop.
   - Tell the user to confirm manually.
5. Do not pass silent install flags unless official MoreLogin documentation explicitly provides them and the user asks for unattended installation.

After the user completes installation:

- Check common install locations for verification.
- Try launching MoreLogin through the Start Menu path or installed executable if discoverable.

## Linux Client Handling

The API may return an AppImage, deb, rpm, tar archive, zip archive, or raw binary. Infer from filename or content type when possible.

Rules:

- Do not run `sudo` without explicit user approval.
- Do not install packages system-wide without user approval.
- Prefer preparing the installer/package and showing the next manual step.

Handling:

- `.AppImage`:
  - Run `chmod +x <path>`.
  - Run it only if the user expects GUI launch.
- `.deb`:
  - Reveal or show the download path.
  - Tell the user installation may require `sudo apt install ./<file>.deb`.
  - Do not run sudo unless the user explicitly approves.
- `.rpm`:
  - Tell the user installation may require `sudo dnf install ./<file>.rpm`.
- `.tar.gz` / `.zip`:
  - Extract only to a user-writable location.
  - Do not copy files into system directories without approval.
- raw binary:
  - Run `chmod +x <path>`.
  - Run only if no system installation is required.

After the user completes installation, verify the executable or application launch path if discoverable.

## Post-Install Verification

After the user says installation is complete, verify MoreLogin can be used by an AI agent.

If CLI is globally available:

```text
ml-cli agent-bootstrap
ml-cli agent-guide
```

If CLI is only available as a downloaded path:

```text
<cli-path> agent-bootstrap
<cli-path> agent-guide
```

If localhost errors such as `connect EPERM 127.0.0.1:40000` occur:

- Treat it as AI-client sandbox/localhost permission first.
- Request local access or elevated execution.
- Do not repeatedly restart the same profile.

## Safety Boundaries

Never:

- Accept Terms of Services or EULA for the user.
- Bypass Gatekeeper, UAC, sudo, administrator prompts, privacy prompts, firewall prompts, or security warnings.
- Install into system PATH without explicit user approval.
- Use silent install flags unless the user explicitly requests it and MoreLogin officially documents them.

Always:

- Check CLI and Client separately.
- Skip Client download when Client is already installed.
- Show exact downloaded file paths.
- Open or reveal installers where possible.
- Explain what user confirmation is required.
- Continue verification after the user confirms installation is complete.

## Copy To Agent Prompt

Use this short prompt for MoreLogin product UI:

```text
请使用 MoreLogin setup skill，在当前电脑上准备 MoreLogin Client 和 MoreLogin CLI。

要求：
- 自动识别当前系统和 CPU 架构，支持 macOS、Windows、Linux。
- 先检查 MoreLogin CLI 是否已安装；没有安装时再查询并下载当前系统对应的最新 CLI。
- 再检查 MoreLogin Client 是否已安装；已经安装时不要重复下载 Client。
- 如果 Client 未安装，再查询并下载当前系统对应的最新 Client 安装包，并根据系统打开或定位安装器。
- 用户需要手动完成 Terms of Services、EULA、Gatekeeper、UAC、sudo、管理员密码、隐私权限等确认。
- 不要代替用户接受协议，不要绕过系统安全机制。
- 安装完成后验证 MoreLogin 是否可被 AI Agent 正常使用。
```
