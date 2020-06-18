#!/usr/bin/env node

'use strict';

// This hook automates this:
// https://github.com/eface2face/cordova-plugin-iosrtc/blob/master/docs/Building.md

var fs = require('fs');
var path = require('path');
var xcode = require('xcode');
var BUILD_VERSION = '10.2'; // Meteor: 10.0
var BUILD_VERSION_XCODE = '"' + BUILD_VERSION + '"';
var RUNPATH_SEARCH_PATHS = '@executable_path/Frameworks';
var RUNPATH_SEARCH_PATHS_XCODE = '"' + RUNPATH_SEARCH_PATHS + '"';
var ENABLE_BITCODE = 'NO'; // Meteor: NO
var ENABLE_BITCODE_XCODE = '"' + ENABLE_BITCODE + '"';
var BRIDGING_HEADER_END = '/Bridging-Header.h';
var BRIDGING_HEADER_CONTENT = '\n#import "cordova-plugin-iosrtc-Bridging-Header.h"';
var COMMENT_KEY = /_comment$/;
var SWIFT_VERSION = '5.0'; // Meteor: 5.0, iosrtc: Swift 4.2+
var DEVELOPMENT_TEAM = '6J92E6W79J'; // set dev team for code signing
var CODE_SIGN_IDENTITY = '"Apple Development"';

// Helpers

// Returns the project name
function getProjectName(protoPath) {
  var cordovaConfigPath = path.join(protoPath, 'config.xml');
  var content = fs.readFileSync(cordovaConfigPath, 'utf-8');
  return /<name>([\s\S]*)<\/name>/im.exec(content)[1].trim();
}

// Drops the comments
function nonComments(obj) {
  var keys = Object.keys(obj);
  var newObj = {};
  var i = 0;
  for (i; i < keys.length; i += 1) {
    if (!COMMENT_KEY.test(keys[i])) {
      newObj[keys[i]] = obj[keys[i]];
    }
  }
  return newObj;
}

// Starting here

module.exports = function(context) {
  var projectRoot = context.opts.projectRoot;
  var projectName = getProjectName(projectRoot);
  var platformPath = path.join(projectRoot, 'platforms', 'ios');
  var projectPath = path.join(platformPath, projectName);
  var xcconfigPath = path.join(projectRoot, '/platforms/ios/cordova/build.xcconfig');
  var xcodeProjectName = projectName + '.xcodeproj';
  var xcodeProjectPath = path.join(platformPath, xcodeProjectName, 'project.pbxproj');
  var swiftBridgingHead = projectName + BRIDGING_HEADER_END;
  var swiftBridgingHeadXcode = '"' + swiftBridgingHead + '"';
  var swiftBridgingHeadPath = path.join(projectPath, BRIDGING_HEADER_END);
  var swiftOptions = ['']; // <-- begin to file appending AFTER initial newline
  var xcodeProject;

  // Checking if the project files are in the right place
  if (!fs.existsSync(xcodeProjectPath)) {
    debugerror('an error occurred searching the project file at: "' + xcodeProjectPath + '"');
    return;
  }
  debug('".pbxproj" project file found: ' + xcodeProjectPath);

  if (!fs.existsSync(xcconfigPath)) {
    debugerror('an error occurred searching the project file at: "' + xcconfigPath + '"');
    return;
  }
  debug('".xcconfig" project file found: ' + xcconfigPath);

  xcodeProject = xcode.project(xcodeProjectPath);

  // Showing info about the tasks to do
  debug('adjusting the generated project files:');
  // debug('- "iOS Deployment Target" and "Deployment Target" to: ' + BUILD_VERSION_XCODE);
  // debug('- "Runpath Search Paths" to: ' + RUNPATH_SEARCH_PATHS_XCODE);
  debug('- "Objective-C Bridging Header" to: ' + swiftBridgingHeadXcode);
  // debug('- "ENABLE_BITCODE" set to: ' + ENABLE_BITCODE_XCODE);
  debug('- Swift version set to: ' + SWIFT_VERSION);
  debug('- Development team set to: ' + DEVELOPMENT_TEAM);

  // Massaging the files

  // "build.xcconfig"
  // swiftOptions.push('LD_RUNPATH_SEARCH_PATHS = ' + RUNPATH_SEARCH_PATHS);
  swiftOptions.push('SWIFT_OBJC_BRIDGING_HEADER = ' + swiftBridgingHead);
  // swiftOptions.push('IPHONEOS_DEPLOYMENT_TARGET = ' + BUILD_VERSION);
  // swiftOptions.push('ENABLE_BITCODE = ' + ENABLE_BITCODE);
  swiftOptions.push('SWIFT_VERSION = ' + SWIFT_VERSION);
  swiftOptions.push('DEVELOPMENT_TEAM = ' + DEVELOPMENT_TEAM);
  // NOTE: Not needed
  // swiftOptions.push('EMBEDDED_CONTENT_CONTAINS_SWIFT = YES');
  fs.appendFileSync(xcconfigPath, swiftOptions.join('\n'));
  debug('file correctly fixed: ' + xcconfigPath);

  // "project.pbxproj"
  // Parsing it
  xcodeProject.parseSync();
  var configurations, buildSettings;

  configurations = nonComments(xcodeProject.pbxXCBuildConfigurationSection());
  // Adding or changing the parameters we need
  Object.keys(configurations).forEach(function(config) {
    buildSettings = configurations[config].buildSettings;
    // buildSettings.LD_RUNPATH_SEARCH_PATHS = RUNPATH_SEARCH_PATHS_XCODE;
    buildSettings.SWIFT_OBJC_BRIDGING_HEADER = swiftBridgingHeadXcode;
    // buildSettings.IPHONEOS_DEPLOYMENT_TARGET = BUILD_VERSION_XCODE;
    // buildSettings.ENABLE_BITCODE = ENABLE_BITCODE_XCODE;
    buildSettings.SWIFT_VERSION = SWIFT_VERSION;
    buildSettings.DEVELOPMENT_TEAM = DEVELOPMENT_TEAM;
    buildSettings.CODE_SIGN_IDENTITY = CODE_SIGN_IDENTITY;
  });

  // Writing the file again
  fs.writeFileSync(xcodeProjectPath, xcodeProject.writeSync(), 'utf-8');
  debug('file correctly fixed: ' + xcodeProjectPath);

  // Append bridging header
  debug('patching bridging header ' + swiftBridgingHeadPath);
  var bridgingHeaderContent = fs.readFileSync(swiftBridgingHeadPath, 'utf-8');
  bridgingHeaderContent += BRIDGING_HEADER_CONTENT;
  fs.writeFileSync(swiftBridgingHeadPath, bridgingHeaderContent, 'utf-8');
};

function debug(msg) {
  console.log('xcode-config-guzz.js [INFO] ' + msg);
}

function debugerror(msg) {
  console.error('xcode-config-guzz.js [ERROR] ' + msg);
}
