# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.26.7] - 2021-09-28
### Changed
- Windows Path fixes in buffer handler

## [2.26.6] - 2021-09-28
### Changed
- copyFilesTo now uses Formatted repo path

## [2.26.5] - 2021-09-28
### Changed
- Skipping Update .syncignore step

## [2.26.4] - 2021-09-27
### Changed
- Removed UnSync from dialog
- Updated private/public msg

## [2.26.3] - 2021-09-24
### Added
- Added a new test case saving IAM credentials

## [2.26.2] - 2021-09-24
### Fixed
- Fixed default branch

## [2.26.1] - 2021-09-24
### Added
- Fixed imports in pathUtils

## [2.26.0] - 2021-09-24
### Added
- Support for Windows

## [2.25.5] - 2021-09-21
### Added
- Tries to upload file first if file ID is not found in config

## [2.25.4] - 2021-09-21
### Added
- Removing CodeSync status bar left-tile upon deactivate

## [2.25.3] - 2021-09-21
### Added
- Removing CodeSync status bar right-tile upon deactivate

## [2.25.2] - 2021-09-20
### Fixed
- Removed repoPath check from activate()

## [2.25.1] - 2021-09-20
### Fixed
- Fixed a syntax issue

## [2.25.0] - 2021-09-20
### Changed
- Choosing first user account by default if there are multiple, not supporting multiple accounts for now

### Improved
- Notification msg updated from _Repo is in sync_ to _Repo XYZ is in sync_
- Refactored Express server using HTML/CSS for better UX
- Improved UX for asking if repo should be public or private
- Menu options change on the fly with 100% coverage

### Fixed
- Uninstall and install CodeSync adds a new tile in bottom right of status bar

## [2.24.0] - 2021-09-15
### Fixed
-Fixed postClickVisibility for syncing repo

## [2.23.0] - 2021-09-14
### Fixed
- Fixed a bug in creating .syncignore from .gitignore
- Updated notification msg for .syncignore, removed Cancel button
- Syncing everything if .syncignore is empty

## [2.22.0] - 2021-09-14
### Added
- Added available options in menu dropdown
### Fixed
- Fixed track file handler

## [2.21.0] - 2021-09-14
### Added
- Unit tests added for utils, logger and commands_handler
### Fixed
- Fixed couple of bugs found in unit testing

## [2.20.0] - 2021-08-24
### Fixed
- Fixed couple of imports

## [2.19.0] - 2021-08-24
### Added
- Separate menu section added for CodeSync
- Creating separate socket connection per repo in buffer handler

## [2.18.0] - 2021-08-23
### Added
- Optimised walk.walker by adding filter to skip specific repos

## [2.17.0] - 2021-08-13
### Added
- View File Playback on CodeSync option added in right click menu

## [2.16.0] - 2021-08-13
### Added
- Updated status bar msg if repo is not connected. Clicking on it triggers Init process
- Applied limit on retry putLogEvent
- Non-IDE events i.e. file create/updated/deleted are now part of daemon

### Fixed
- Fixed duplicate auth-server run

## [2.15.0] - 2021-08-07
### Added
- Option to Unsync the repo

## [2.14.0] - 2021-08-05
### Added
- Logout and connect to other account
### Fixed
- Fixed success msg when init is completed

## [2.13.0] - 2021-07-31
### Added
- Improved msg to update syncignore

## [2.12.0] - 2021-07-30
### Added
- Auth Flow with server based redirection
- Status bar messages from daemon for sending diffs, service down, auth failed etc

## [2.11.0] - 2021-07-27
### Added
- Couple improvements
- Ask To Login if token is invalid in following cases:
    - If is syncing branch
    - Sending diffs

## [2.10.0] - 2021-07-26
### Added
- View added if no repo is opened

## [2.9.0] - 2021-07-19
### Added
- Button added in notifications to Track your repo (Playback)

## [2.8.0] - 2021-07-19
### Added
- Link added in right panel view to Track your repo (Playback)

## [2.7.0] - 2021-07-16
### Changed
- Daemon now detects the branch change and syncs it if server is up, handled offline case as well

## [2.6.0] - 2021-07-15
### Added
- Init Flow, Should be able to connect a repo with CodeSync
- Button with icon added in status bar
- Views added in right panel for sign up, Connect a repo and Unsync a repo

### Changed
- Updated README

## [2.5.0] - 2021-06-23
### Added
- SignUp Flow integrated
- Running a server in IDE to redirect after Auth
- Refactored code, dynamic redirectUri for SignUp process
- Defined 10 ports to be used for Auth Server

## [2.4.0] - 2021-06-22
### Added
- Fixed lstat for deleted file, fixed new-file upload config issue
  
## [2.3.0] - 2021-06-18
### Added
- Checking lstat after verifying file is syncable

### Fixed
- Checking lstat after making sure file exists and is synable

## [2.2.0] - 2021-06-15
### Fixed
- Using form.submit() to upload file to s3
- Fixed non-empty file upload, using File Watcher for pasted file

## [2.1.0] - 2021-06-15
### Fixed
- Fixed new-file-upload by returning configJSON
- Added missing semi colons

## [2.0.0] - 2021-06-14
### Added
- Daemon with basic functionality of checking server availability, validating and grouping diffs
- Diffs are being uploaded to server via websocket
- Docs added for handleBuffer, Fixed order of uploading diffs after authentication
- utils/buffer_utils.ts added
- is_dir_rename & is_rename diffs handled, using walk package for os.walk
- Implemented New File Upload to server & s3, new package added isbinaryfile
- put_log_events replicated using aws-sdk
- Directory delete handled

### Changed
- Common function added to manage diffs
- Cleaned buffer_handler.ts

### Fixed
- File Deleted Diffs managed by computing diff with shadow
- Corrected basePath for file delete event

## [1.5.0] - 2021-05-01
### Changed
- Updated README: removing period causing extra bullet point

## [1.4.0] - 2021-05-01
### Changed
- Updating readme for tremendous enjoyment and superior marketing

## [1.3.0] - 2021-04-30
### Changed
- Added icon in package.json

## [1.2.0] - 2021-04-16
### Changed
- repoPath is now checked only inside of events

## [1.1.0] - 2021-04-08
### Changed
- README Updated

## [1.0.0] - 2021-04-03
### Added
- Handling events for File Create/Update/Rename/Delete
- Directory level diffs implemented
- Skipping events if directory is not synced
- Ignoring .git repo to be synced for all events
- Directory rename has been handled
- Skipping directory events for New/Deleted events
- DirRename diff introduced to manage nested renames from daemon side

### Fixed
- Fixed duplication for FileDeleted events
- Fixed lodash vulnerability mentioned by Dependabot alert of github
