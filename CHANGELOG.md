# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.7.0] - 2021-07-16
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
