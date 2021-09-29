# Security Policy

## Supported Versions- name: AWS SSM Build Secrets for GitHub Actions

  # You may pin to the exact commit or the version.

  # uses: marvinpinto/action-inject-ssm-secrets@3bb59520768371a76609c11678e23c2c911899d9

  uses: marvinpinto/action-inject-ssm-secrets@v1.2.1

  with:

    # The SSM key to look up

    ssm_parameter: 

    # The corresponding environment variable name to assign the secret to

    env_variable_name: 

Use this section to tell people about which versions of your project are
currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 5.1.x   | :white_check_mark: |
| 5.0.x   | :x:                |
| 4.0.x   | :white_check_mark: |
| < 4.0   | :x:                |

## Reporting a Vulnerability

Use this section to tell people how to report a vulnerability.

Tell them where to go, how often they can expect to get an update on a
reported vulnerability, what to expect if the vulnerability is accepted or
declined, etc.
