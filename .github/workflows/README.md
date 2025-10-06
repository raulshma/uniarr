# GitHub Actions - CI/CD Workflows

Automated build and deployment workflows for the Unsmoke project using GitHub Actions and Expo EAS.

## 🚀 Overview

This repository includes automated workflows for building and deploying the mobile application using Expo EAS Build. The workflows are triggered on code pushes to specific branches and provide automated APK generation with artifact storage.

## 📋 Workflows

### Android APK Build

**File**: `.github/workflows/android-build.yml`

Builds an Android APK using Expo EAS when code is pushed to the `release` branch.

#### Trigger Conditions
- **Branch**: Push to `release` branch only
- **Environment**: Production environment (for accessing secrets)
- **Manual**: Can be triggered manually via GitHub UI

#### Workflow Steps
1. **Checkout Code**: Retrieves the latest code from the repository
2. **Setup Node.js**: Configures Node.js environment
3. **Install Dependencies**: Installs npm packages in the client directory
4. **Setup Expo**: Configures Expo CLI and authentication
5. **Build APK**: Uses EAS Build to create Android APK
6. **Upload Artifact**: Stores the APK as a GitHub artifact

#### Output
- **Artifact Name**: `app-release`
- **File Type**: Android APK
- **Distribution**: Internal testing/distribution

## ⚙️ Configuration

### Required Secrets

Configure these secrets in your GitHub repository settings:

- **`EXPO_TOKEN`**: Your Expo authentication token
  - **Location**: Repository Settings → Secrets and Variables → Actions
  - **Environment**: Production
  - **Purpose**: Authenticates with Expo EAS Build service

### Environment Variables

Configure in the production environment:

- **App-specific variables**: Any environment variables needed for the build
- **Build configuration**: Custom build settings and profiles

### Getting the EXPO_TOKEN

1. **Install EAS CLI globally:**
   ```bash
   npm install -g eas-cli
   ```

2. **Login to your Expo account:**
   ```bash
   eas login
   ```

3. **Generate authentication token:**
   ```bash
   eas build:configure
   ```

4. **Copy the token** to your repository secrets as `EXPO_TOKEN`

## 🔧 Build Configuration

### EAS Build Profile

The workflow uses the `preview` profile from `eas.json`:

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk",
        "distribution": "internal"
      }
    }
  }
}
```

**Profile Features**:
- **Output**: APK file (not AAB for easier testing)
- **Distribution**: Internal distribution channel
- **Gradle Command**: `:app:assembleRelease`
- **Optimization**: Production optimizations enabled

### Workflow Environment

- **Node.js Version**: Latest LTS
- **Environment**: Production (for secrets access)
- **Timeout**: 30 minutes (configurable)
- **Runner**: Ubuntu latest

## 🧪 Local Testing

### Test Build Locally

Test the build process on your local machine:

```bash
# Navigate to client directory
cd client

# Install dependencies
bun install

# Run local EAS build
eas build --platform android --profile preview --local
```

**Requirements for Local Builds**:
- **Android SDK**: Properly configured Android development environment
- **Java JDK**: Version 11 or higher
- **EAS CLI**: Latest version installed globally
- **Docker**: For containerized builds (optional)

### Manual Workflow Trigger

You can manually trigger the workflow from the GitHub UI:

1. Go to **Actions** tab in your repository
2. Select **Android APK Build** workflow
3. Click **Run workflow**
4. Choose the branch and click **Run workflow**

## 📱 Deployment Strategies

### Current Setup: Internal Distribution

The current workflow builds APKs for internal testing:

- **Use Case**: Internal team testing, QA validation
- **Distribution**: Manual download from GitHub artifacts
- **Signing**: Development/preview signing

### Future Enhancements

Consider these additional workflows:

#### Production Release Workflow
```yaml
# .github/workflows/production-release.yml
name: Production Release
on:
  push:
    tags:
      - 'v*'
```

#### App Store Deployment
```yaml
# For Google Play Store deployment
- name: Deploy to Play Store
  uses: r0adkll/upload-google-play@v1
```

#### iOS Build Workflow
```yaml
# For iOS builds
- name: Build iOS
  run: eas build --platform ios --profile production
```

## 🚨 Troubleshooting

### Common Issues

#### Build Failures

1. **Expo Token Issues**:
   ```
   Error: Authentication failed
   ```
   - **Solution**: Regenerate `EXPO_TOKEN` and update repository secrets

2. **Dependency Issues**:
   ```
   Error: Package not found
   ```
   - **Solution**: Ensure `package.json` is up to date and dependencies are correctly specified

3. **EAS Configuration Issues**:
   ```
   Error: Invalid build profile
   ```
   - **Solution**: Validate `eas.json` configuration file

#### Workflow Debug

Enable debug logging by adding these secrets:
- `ACTIONS_STEP_DEBUG`: `true`
- `ACTIONS_RUNNER_DEBUG`: `true`

### Build Logs

Access build logs through:
1. **GitHub Actions**: Actions tab → Workflow run → Job logs
2. **EAS Build**: Expo dashboard build logs
3. **Local Build**: Terminal output during local builds

## 📊 Monitoring & Analytics

### Build Metrics

Track these metrics for build health:

- **Build Success Rate**: Percentage of successful builds
- **Build Duration**: Time taken for builds to complete
- **Artifact Size**: APK file size trends
- **Failure Patterns**: Common build failure causes

### Notifications

Set up notifications for build events:

```yaml
# Add to workflow for Slack notifications
- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## 🔒 Security Considerations

### Token Security

- **EXPO_TOKEN**: Sensitive token with build permissions
- **Rotation**: Rotate tokens regularly
- **Scope**: Limit token permissions to build-only

### Secrets Management

- **Environment Separation**: Use different tokens for different environments
- **Access Control**: Limit repository access to necessary team members
- **Audit Logs**: Monitor secret usage and access

## 📚 Additional Resources

- **[GitHub Actions Documentation](https://docs.github.com/en/actions)**
- **[Expo EAS Build Documentation](https://docs.expo.dev/build/introduction/)**
- **[Expo EAS CLI Reference](https://docs.expo.dev/build-reference/cli/)**
- **[Android Build Configuration](https://docs.expo.dev/build-reference/android-builds/)**

## 🤝 Contributing

When modifying CI/CD workflows:

1. **Test Changes**: Always test workflow changes on feature branches
2. **Documentation**: Update this README for any workflow changes
3. **Security**: Review security implications of new steps or secrets
4. **Performance**: Optimize build times and resource usage
5. **Notifications**: Ensure team is notified of workflow changes

## 📄 License

This project is private and proprietary. All rights reserved.