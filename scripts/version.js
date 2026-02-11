#!/usr/bin/env node

/**
 * Version Management Script for Text Diff Tool
 * 
 * This script manages version incrementing and updates all version references
 * in the codebase when patch versions are incremented.
 * 
 * Usage:
 *   node scripts/version.js --increment-patch
 *   node scripts/version.js --get-version
 *   node scripts/version.js --set-version 0.2.0
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const VERSION_FILES = {
  'index.html': [
    { regex: /current:\s*"(\d+\.\d+\.\d+)"/g, group: 1 },
    { regex: /Version:\s*<span id="version-display">(\d+\.\d+\.\d+)<\/span>/g, group: 1 },
    { regex: /Version:\s*<span id="version-display">(\d+\.\d+\.\d+)<\/span>/g, group: 1 },
  ],
  'README.md': [
    { regex: /\*\*Version\*\*:\s*(\d+\.\d+\.\d+)/g, group: 1 },
  ]
};

class VersionManager {
  constructor() {
    this.currentVersion = null;
    this.loadCurrentVersion();
  }

  loadCurrentVersion() {
    // Try to find current version from any file
    for (const [file, patterns] of Object.entries(VERSION_FILES)) {
      const filePath = path.join(PROJECT_ROOT, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        for (const pattern of patterns) {
          const match = pattern.regex.exec(content);
          if (match) {
            this.currentVersion = match[pattern.group];
            return;
          }
        }
      }
    }
    
    // If no version found, default to 0.1.0
    this.currentVersion = '0.1.0';
  }

  getCurrentVersion() {
    return this.currentVersion;
  }

  incrementPatchVersion() {
    const [major, minor, patch] = this.currentVersion.split('.').map(Number);
    const newVersion = `${major}.${minor}.${patch + 1}`;
    this.updateVersion(newVersion);
    return newVersion;
  }

  setVersion(newVersion) {
    this.updateVersion(newVersion);
  }

  updateVersion(newVersion) {
    this.currentVersion = newVersion;
    
    // Update all version references
    for (const [file, patterns] of Object.entries(VERSION_FILES)) {
      const filePath = path.join(PROJECT_ROOT, file);
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        for (const pattern of patterns) {
          content = content.replace(pattern.regex, (match, currentVersion) => {
            return match.replace(currentVersion, newVersion);
          });
        }
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated version in ${file} to ${newVersion}`);
      }
    }
    
    // Update the JavaScript version object in index.html
    this.updateJSVersion(newVersion);
  }

  updateJSVersion(newVersion) {
    const indexFilePath = path.join(PROJECT_ROOT, 'index.html');
    if (fs.existsSync(indexFilePath)) {
      let content = fs.readFileSync(indexFilePath, 'utf8');
      
      // Update the VERSION object
      content = content.replace(
        /current:\s*"(\d+\.\d+\.\d+)"/g,
        `current: "${newVersion}"`
      );
      
      fs.writeFileSync(indexFilePath, content, 'utf8');
      console.log(`Updated JS version object to ${newVersion}`);
    }
  }

  validateVersion(version) {
    return /^\d+\.\d+\.\d+$/.test(version);
  }
}

// Command line interface
if (require.main === module) {
  const manager = new VersionManager();
  const args = process.argv.slice(2);
  
  if (args.includes('--increment-patch')) {
    const newVersion = manager.incrementPatchVersion();
    console.log(`Incremented patch version to ${newVersion}`);
  } else if (args.includes('--get-version')) {
    console.log(manager.getCurrentVersion());
  } else if (args.includes('--set-version')) {
    const newVersion = args[args.indexOf('--set-version') + 1];
    if (newVersion && manager.validateVersion(newVersion)) {
      manager.setVersion(newVersion);
      console.log(`Set version to ${newVersion}`);
    } else {
      console.error('Invalid version format. Use --set-version X.Y.Z');
      process.exit(1);
    }
  } else {
    console.log('Version Manager for Text Diff Tool');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/version.js --increment-patch   Increment patch version (X.Y.Z → X.Y.Z+1)');
    console.log('  node scripts/version.js --get-version        Get current version');
    console.log('  node scripts/version.js --set-version X.Y.Z  Set specific version');
    console.log('');
    console.log('Current version:', manager.getCurrentVersion());
  }
}

module.exports = VersionManager;