/**
 * Copyright 2014 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Lets you run Shumway from the command line.
 */

declare var scriptArgs;
declare var arguments;
declare var load;
declare var quit;
declare var read;
declare var help;
declare var timeout;
declare var printErr;

// Number of errors thrown, used for shell scripting to return non-zero exit codes.
var errors = 0;

var homePath = "";
//load(homePath + "build/libs/relooper.js");
var builtinABCPath = homePath + "build/libs/builtin.abc";
var shellABCPath = homePath + "build/libs/shell.abc";
var playerglobalInfo = {
  abcs: homePath + "build/playerglobal/playerglobal.abcs",
  catalog: homePath + "build/playerglobal/playerglobal.json"
};

declare var readFile, readBinaryFile, readbuffer;
var isV8 = typeof readbuffer !== 'undefined';
var isJSC = typeof readFile !== 'undefined';
if (isV8) {
  var oldread = read;
  read = function (path, type) {
    return type === 'binary' ? new Uint8Array(readbuffer(path)) : oldread(path);
  }
} else if (isJSC) {
  if (typeof readBinaryFile === 'undefined') {
    throw new Error('readBinaryFile was not found');
  }
  read = function (path, type) {
    return type === 'binary' ? new Uint8Array(readBinaryFile(path)) : readFile(path);
  }
}
if (typeof read === 'undefined') {
  throw new Error('Unable to simulate read()');
}

if (isV8 || isJSC) {
  // v8 and jsc will fail for Promises
  this.Promise = undefined;
}

/**
 * Global unitTests array, unit tests add themselves to this. The list may have numbers, these indicate the
 * number of times to run the test following it. This makes it easy to disable test by pushing a zero in
 * front.
 */
var unitTests = [];

declare var microTaskQueue: Shumway.Shell.MicroTasksQueue;

var commandLineArguments: string [];
// SpiderMonkey
if (typeof scriptArgs === "undefined") {
  commandLineArguments = arguments;
} else {
  commandLineArguments = scriptArgs;
}

var disableBundleSelection;
try {
  disableBundleSelection = read('build/ts/shell.conf') === 'dist';
} catch (e) {
  disableBundleSelection = false;
}

// The command line parser isn't yet available, so do a rough manual check for whether the bundled
// player source should be used.
if (disableBundleSelection || commandLineArguments.indexOf('--bundle') >= 0) {
  load('build/bundles/shumway.player.js');
} else if (commandLineArguments.indexOf('-b') >= 0 || commandLineArguments.indexOf('--closure-bundle') >= 0) {
  load('build/bundles-cc/shumway.player.js');
} else {
  /* Autogenerated player references: base= */

  load("build/ts/base.js");
  load("build/ts/tools.js");

  load("build/ts/avm2.js");

  load("build/ts/swf.js");

  load("build/ts/flash.js");

  load("build/ts/avm1.js");

  load("build/ts/gfx-base.js");
  load("build/ts/player.js");

  /* Autogenerated player references end */
}

module Shumway.Shell {
  import assert = Shumway.Debug.assert;
  import ABCFile = Shumway.AVMX.ABCFile;
  import WriterFlags = Shumway.AVMX.WriterFlags;

  import Option = Shumway.Options.Option;
  import OptionSet = Shumway.Options.OptionSet;
  import ArgumentParser = Shumway.Options.ArgumentParser;

  import Runtime = Shumway.AVM2.Runtime;
  import SwfTag = Shumway.SWF.Parser.SwfTag;
  import DataBuffer = Shumway.ArrayUtilities.DataBuffer;

  import Compiler = Shumway.AVM2.Compiler;

  class ShellGFXServer implements Shumway.Remoting.IGFXService {
    addObserver(observer: Shumway.Remoting.IGFXServiceObserver) {
      // Ignoring
    }

    removeObserver(observer: Shumway.Remoting.IGFXServiceObserver) {
      // Ignoring
    }

    update(updates: DataBuffer, assets: any[]): void {
      var bytes = updates.getBytes();
      // console.log('Updates sent');
      return null;
    }

    updateAndGet(updates: DataBuffer, assets: any[]): any {
      var bytes = updates.getBytes();

      // Simulating text field metrics
      var buffer = new DataBuffer();
      buffer.write2Ints(1, 1); // textWidth, textHeight
      buffer.writeInt(0); // offsetX
      buffer.writeInt(0); // numLines
      buffer.position = 0;
      return buffer;
    }

    frame(): void {
      // console.log('Frame');
    }

    videoControl(id: number, eventType: Shumway.Remoting.VideoControlEvent, data: any): any {
      // console.log('videoControl');
    }

    registerFont(syncId: number, data: any): Promise<any> {
      // console.log('registerFont');
      return Promise.resolve(undefined);
    }

    registerImage(syncId: number, symbolId: number, data: any): Promise<any> {
      // console.log('registerImage');
      return Promise.resolve({width: 100, height: 50});
    }

    fscommand(command: string, args: string): void {
      if (command === 'quit') {
        // console.log('Player quit');
        microTaskQueue.stop();
      }
    }
  }

  var verbose = false;
  var writer = new IndentingWriter();

  var parseOption: Option;
  var disassembleOption: Option;
  var compileOption: Option;
  var verboseOption: Option;
  var profileOption: Option;
  var releaseOption: Option;
  var executeOption: Option;
  var interpreterOption: Option;
  var symbolFilterOption: Option;
  var microTaskDurationOption: Option;
  var microTaskCountOption: Option;
  var maxFrameCountOption: Option;
  var repeatOption: Option;
  var loadPlayerGlobalCatalogOption: Option;
  var loadShellLibOption: Option;
  var porcelainOutputOption: Option;
  var usePlayerBundleOption: Option;
  var usePlayerClosureBundleOption: Option;

  var fuzzMillOption: Option;
  var writersOption: Option;

  function Timeout() {}
  export function main(commandLineArguments: string []) {
    var systemOptions: Shumway.Options.OptionSet = Shumway.Settings.shumwayOptions;
    var shellOptions = systemOptions.register(new Shumway.Options.OptionSet("Shell Options"));

    parseOption = shellOptions.register(new Option("p", "parse", "boolean", false, "Parse File(s)"));
    disassembleOption = shellOptions.register(new Option("d", "disassemble", "boolean", false, "Disassemble File(s)"));
    compileOption = shellOptions.register(new Option("c", "compile", "boolean", false, "Compile File(s)"));
    verboseOption = shellOptions.register(new Option("v", "verbose", "boolean", false, "Verbose"));
    profileOption = shellOptions.register(new Option("o", "profile", "boolean", false, "Profile"));
    releaseOption = shellOptions.register(new Option("r", "release", "boolean", false, "Release mode"));
    if (!disableBundleSelection) {
      usePlayerClosureBundleOption = shellOptions.register(new Option('b', "closure-bundle", "boolean", false, "Use bundled and closure compiled source file for the player."));
      usePlayerBundleOption = shellOptions.register(new Option('', "bundle", "boolean", false, "Use bundled source file for the player."));
    }
    executeOption = shellOptions.register(new Option("x", "execute", "boolean", false, "Execute File(s)"));
    interpreterOption = shellOptions.register(new Option("i", "interpreter", "boolean", false, "Interpreter Only"));
    symbolFilterOption = shellOptions.register(new Option("f", "filter", "string", "", "Symbol Filter"));
    microTaskDurationOption = shellOptions.register(new Option("md", "duration", "number", 0, "Micro task duration."));
    microTaskCountOption = shellOptions.register(new Option("mc", "count", "number", 0, "Micro task count."));
    maxFrameCountOption = shellOptions.register(new Option("fc", "frameCount", "number", 0, "Frame count."));
    repeatOption = shellOptions.register(new Option("rp", "rp", "number", 1, "Repeat count."));
    loadPlayerGlobalCatalogOption = shellOptions.register(new Option("g", "playerGlobal", "boolean", false, "Load Player Global"));
    loadShellLibOption = shellOptions.register(new Option("s", "shell", "boolean", false, "Load Shell Global"));
    porcelainOutputOption = shellOptions.register(new Option('', "porcelain", "boolean", false, "Keeps outputs free from the debug messages."));

    fuzzMillOption = shellOptions.register(new Option('', "fuzz", "string", "", "Generates random SWFs XML."));

    writersOption = shellOptions.register(new Option("w", "writers", "string", "", "Writers Filter [r: runtime, i: interpreter]"));

    var argumentParser = new ArgumentParser();
    argumentParser.addBoundOptionSet(systemOptions);

    function printUsage() {
      writer.enter("Shumway Command Line Interface");
      systemOptions.trace(writer);
      writer.leave("");
    }

    argumentParser.addArgument("h", "help", "boolean", {parse: function (x) {
      printUsage();
    }});

    var files = [];

    // Try and parse command line arguments.

    try {
      argumentParser.parse(commandLineArguments).filter(function (value, index, array) {
        if (value.endsWith(".abc") || value.endsWith(".swf") || value.endsWith(".js") || value.endsWith(".json")) {
          files.push(value);
        } else {
          return true;
        }
      });
    } catch (x) {
      writer.writeLn(x.message);
      quit();
    }

    initializePlayerServices();

    microTaskQueue = new Shumway.Shell.MicroTasksQueue();

    if (porcelainOutputOption.value) {
      console.info = console.log = console.warn = console.error = jsGlobal.print = function () {};
    }

    profile = profileOption.value;
    release = releaseOption.value;
    verbose = verboseOption.value;

    if (!verbose) {
      IndentingWriter.logLevel = Shumway.LogLevel.Error | Shumway.LogLevel.Warn;
    }

    if (fuzzMillOption.value) {
      var fuzzer = new Shumway.Shell.Fuzz.Mill(new IndentingWriter(), fuzzMillOption.value);
      fuzzer.fuzz();
    }

    Shumway.Unit.writer = new IndentingWriter();

    var writerFlags = WriterFlags.None;
    if (writersOption.value.indexOf("r") >= 0) {
      writerFlags |= WriterFlags.Runtime;
    }
    if (writersOption.value.indexOf("i") >= 0) {
      writerFlags |= WriterFlags.Interpreter;
    }
    Shumway.AVMX.setWriters(writerFlags);

    if (compileOption.value) {
      var buffers = [];
      files.forEach(function (file) {
        var buffer = new Uint8Array(read(file, "binary"));
        if (file.endsWith(".abc")) {
          buffers.push(buffer);
        } else if (file.endsWith(".swf")) {
          buffers.push.apply(buffers, extractABCsFromSWF(buffer));
        }
      });
      verbose && writer.writeLn("Loading " + buffers.length + " ABCs");
      Shumway.Debug.notImplemented("Compile");
      Shumway.AVM2.timelineBuffer.createSnapshot().trace(new IndentingWriter());
    }

    if (parseOption.value) {
      files.forEach(function (file) {
        var start = dateNow();
        writer.debugLn("Parsing: " + file);
        profile && SWF.timelineBuffer.reset();
        try {
          parsingCounter.clear();
          parseFile(file, symbolFilterOption.value.split(","));
          var elapsed = dateNow() - start;
          if (verbose) {
            writer.writeLn("Total Parse Time: " + (elapsed).toFixed(2) + " ms.");
            profile && SWF.timelineBuffer.createSnapshot().trace(writer);
          }
        } catch (e) {
          writer.writeLn("EXCEPTED: " + file);
        }
      });
    }

    if (executeOption.value) {
      var shouldLoadPlayerGlobalCatalog = loadPlayerGlobalCatalogOption.value;
      if (!shouldLoadPlayerGlobalCatalog) {
        // We need to load player globals if any swfs need to be executed.
        files.forEach(file => {
          if (file.endsWith(".swf")) {
            shouldLoadPlayerGlobalCatalog = true;
          }
        });
      }
      executeFiles(files);
    } else if (disassembleOption.value) {
      var securityDomain = createSecurityDomain(builtinABCPath, null, null);
      files.forEach(function (file) {
        if (file.endsWith(".abc")) {
          disassembleABCFile(securityDomain, file);
        }
      });
    }
    if (errors) {
      quit(1);
    }
    if (Shumway.Unit.everFailed) {
      writer.errorLn('Some unit tests failed');
      quit(1);
    }
  }

  function disassembleABCFile(securityDomain: ISecurityDomain, file: string) {
    try {
      var buffer = read(file, "binary");
      var abc = new ABCFile(new Uint8Array(buffer), file);
      // We need to load the ABCFile in a |securityDomain| because the parser may
      // throw verifier errors.
      securityDomain.application.loadABC(abc);
      abc.trace(writer);
    } catch (x) {
      writer.redLn('Exception encountered while running ' + file + ': ' + '(' + x + ')');
      writer.redLns(x.stack);
      errors ++;
    }
  }

  function executeFiles(files: string []): boolean {
    // If we're only dealign with .abc files, run them all in the same domain.
    if (files.every(function (file) {
        return file.endsWith(".abc");
      })) {
      executeABCFiles(files);
      return;
    }
    files.forEach(function (file) {
      if (file.endsWith(".js")) {
        executeUnitTestFile(file);
      } else if (file.endsWith(".json")) {
        executeJSONFile(file);
      } else if (file.endsWith(".abc")) {
        executeABCFiles([file]);
      } else if (file.endsWith(".swf")) {
        executeSWFFile(file, microTaskDurationOption.value, microTaskCountOption.value, maxFrameCountOption.value);
      }
    });
    return true;
  }

  function executeSWFFile(file: string, runDuration: number, runCount: number, frameCount: number) {
    if (verbose) {
      writer.writeLn("executeSWF: " + file +
                     ", runDuration: " + runDuration +
                     ", runCount: " + runCount +
                     ", frameCount: " + frameCount);
    }
    function runSWF(file: any) {
      // REDUX:
      // flash.display.Loader.reset();
      // flash.display.DisplayObject.reset();
      // flash.display.MovieClip.reset();
      var securityDomain = createSecurityDomain(builtinABCPath, null, null);
      var player = new Shumway.Player.Player(securityDomain, new ShellGFXServer());
      player.load(file);
      return player;
    }

    var player = null;
    var asyncLoading = true;
    if (asyncLoading) {
      (<any>Shumway.FileLoadingService.instance).setBaseUrl(file);
      player = runSWF(file);
    } else {
      (<any>Shumway.FileLoadingService.instance).setBaseUrl(file);
      player = runSWF(read(file, 'binary'));
    }

    try {
      var hash = 0;
      microTaskQueue.run(runDuration, runCount, true, function () {
        if (!frameCount) {
          return true;
        }
        hash = HashUtilities.mixHash(hash, player.stage.hashCode());
        // Exit if we've executed enough frames.
        return player.framesPlayed <= frameCount;
      });
      if (verbose) {
        writer.writeLn("executeSWF PASS: " + file);
      }
      writer.writeLn(file + ": " + IntegerUtilities.toHEX(hash));
    } catch (x) {
      writer.redLn('Exception: ' + '(' + x + ')');
      writer.redLns(x.stack);
    }
  }

  function executeJSONFile(file: string) {
    if (verbose) {
      writer.writeLn("executeJSON: " + file);
    }
    // Remove comments
    var json = JSON.parse(read(file, "text").split("\n").filter(function (line) {
      return line.trim().indexOf("//") !== 0;
    }).join("\n"));

    json.forEach(function (run, i) {
      printErr("Running batch " + (i + 1) + " of " + json.length + " (" + run[1].length + " tests)");
      var securityDomain = createSecurityDomain(builtinABCPath, null, null);
      // Run libraries.
      run[0].forEach(function (file) {
        var buffer = new Uint8Array(read(file, "binary"));
        var abc = new ABCFile(buffer);
        if (verbose) {
          writer.writeLn("executeABC: " + file);
        }
        securityDomain.application.loadABC(abc);
        securityDomain.application.executeABC(abc);
      });
      // Run files.
      run[1].forEach(function (file) {
        try {
          if (verbose) {
            writer.writeLn("executeABC: " + file);
          }
          timeout(10, function () {
            writer.writeLn("TIMEDOUT!");
            throw new Timeout();
          });
          var buffer = new Uint8Array(read(file, "binary"));
          var abc = new ABCFile(buffer);
          securityDomain.application.loadABC(abc);
          var t = dateNow();
          securityDomain.application.executeABC(abc);
          var e = (dateNow() - t);
          if (e > 100) {
            printErr("Test: " + file + " is very slow (" + e.toFixed() + " ms), consider disabling it.");
          }
          if (verbose) {
            writer.writeLn("executeABC PASS: " + file);
          }
        } catch (x) {
          if (verbose) {
            writer.writeLn("executeABC FAIL: " + file);
          }
          writer.writeLn("EXCEPTED: " + file);
          try {
            writer.redLn('Exception: ' + '(' + x + ')');
            writer.redLns(x.stack);
          } catch (y) {
            writer.writeLn("Error printing error.");
          }
          errors ++;
        }
      });
    });
  }

  function executeABCFiles(files: string []) {
    var securityDomain = createSecurityDomain(builtinABCPath, null, null);
    files.forEach(function (file) {
      try {
        if (verbose) {
          writer.writeLn("executeABC: " + file);
        }
        timeout(5, function () {
          throw new Timeout();
        });
        var buffer = new Uint8Array(read(file, "binary"));
        var abc = new ABCFile(buffer);
        securityDomain.application.loadABC(abc);
        securityDomain.application.executeABC(abc);
        if (verbose) {
          writer.writeLn("executeABC PASS: " + file);
        }
      } catch (x) {
        if (verbose) {
          writer.writeLn("executeABC FAIL: " + file);
        }
        try {
          writer.redLn('Exception encountered while running ' + file + ': ' + '(' + x + ')');
          writer.redLns(x.stack);
        } catch (y) {
          writer.writeLn("Error printing error.");
        }
        errors ++;
      }
    });
  }

  function executeUnitTestFile(file: string) {
    var securityDomain = createSecurityDomain(builtinABCPath, null, null);
    Shumway.AVMX.AS.installClassLoaders(securityDomain.application, jsGlobal);

    // Make the securityDomain available on the global object for ease of use
    // in unit tests.
    jsGlobal.securityDomain = securityDomain;

    writer.writeLn("Running test file: " + file + " ...");
    var start = dateNow();
    load(file);
    var testCount = 0;
    while (unitTests.length) {
      var test = unitTests.shift();
      var repeat = 1;
      if (typeof test === "number") {
        repeat = test;
        test = unitTests.shift();
      }
      if (verbose && test.name) {
        writer.writeLn("Test: " + test.name);
      }
      testCount += repeat;
      try {
        for (var i = 0; i < repeat; i++) {
          test();
        }
      } catch (x) {
        writer.redLn('Exception encountered while running ' + file + ':' + '(' + x + ')');
        writer.redLns(x.stack);
      }
    }
    writer.writeLn("Completed " + testCount + " test" + (testCount > 1 ? "s" : "") + " in " + (dateNow() - start).toFixed(2) + " ms.");
    writer.outdent();
  }

  function ignoreTag(code, symbolFilters) {
    if (symbolFilters[0].length === 0) {
      return false;
    }
    for (var i = 0; i < symbolFilters.length; i++) {
      var filterCode = SwfTag[symbolFilters[i]];
      if (filterCode !== undefined && filterCode === code) {
        return false;
      }
    }
    return true;
  }

  function extractABCsFromSWF(buffer: Uint8Array): Uint8Array [] {
    var abcData = [];
    try {
      var loadListener: ILoadListener = {
        onLoadOpen: function(file: Shumway.SWF.SWFFile) {
          for (var i = 0; i < file.abcBlocks.length; i++) {
            var abcBlock = file.abcBlocks[i];
            abcData.push(abcBlock.data);
          }
        },
        onLoadProgress: function(update: LoadProgressUpdate) {
        },
        onLoadError: function() {
        },
        onLoadComplete: function() {
        },
        onNewEagerlyParsedSymbols(dictionaryEntries: SWF.EagerlyParsedDictionaryEntry[], delta: number): Promise<any> {
          return Promise.resolve();
        },
        onImageBytesLoaded() {}
      };
      var loader = new Shumway.FileLoader(loadListener);
      loader.loadBytes(buffer);
    } catch (x) {
      writer.redLn("Cannot parse SWF, reason: " + x);
      return null;
    }
    return abcData;
  }

  var parsingCounter = new Shumway.Metrics.Counter(true);

  /**
   * Parses file.
   */
  function parseFile(file: string, symbolFilters: string []): boolean {
    var fileName = file.replace(/^.*[\\\/]/, '');
    function parseABC(buffer: Uint8Array) {
      var abcFile = new ABCFile(buffer, "ABC");
      // abcFile.trace(writer);
    }
    var buffers = [];
    if (file.endsWith(".swf")) {
      var fileNameWithoutExtension = fileName.substr(0, fileName.length - 4);
      var SWF_TAG_CODE_DO_ABC = SwfTag.CODE_DO_ABC;
      var SWF_TAG_CODE_DO_ABC_ = SwfTag.CODE_DO_ABC_DEFINE;
      try {
        var buffer = read(file, "binary");
        var startSWF = dateNow();
        var swfFile: Shumway.SWF.SWFFile;
        var loadListener: ILoadListener = {
          onLoadOpen: function(swfFile: Shumway.SWF.SWFFile) {
            if (swfFile && swfFile.abcBlocks) {
              for (var i = 0; i < swfFile.abcBlocks.length; i++) {
                parseABC(swfFile.abcBlocks[i].data);
              }
            }
            if (swfFile instanceof Shumway.SWF.SWFFile) {
              var dictionary = swfFile.dictionary;
              for (var i = 0; i < dictionary.length; i++) {
                if (dictionary[i]) {
                  var s = performance.now();
                  var symbol = swfFile.getSymbol(dictionary[i].id);
                  parsingCounter.count(symbol.type, performance.now() - s);
                }
              }
            } else if (swfFile instanceof Shumway.ImageFile) {
              // ...
            }
          },
          onLoadProgress: function(update: LoadProgressUpdate) {
          },
          onLoadError: function() {
          },
          onLoadComplete: function() {
            writer.redLn("Load complete:");
          },
          onNewEagerlyParsedSymbols(dictionaryEntries: SWF.EagerlyParsedDictionaryEntry[],
                                    delta: number): Promise<any> {
            return Promise.resolve();
          },
          onImageBytesLoaded() {}
        };
        var loader = new Shumway.FileLoader(loadListener);
        loader.loadBytes(buffer);
      } catch (x) {
        writer.redLn("Cannot parse: " + file + ", reason: " + x);
        if (verbose) {
          writer.redLns(x.stack);
        }
        errors ++;
        return false;
      }
    } else if (file.endsWith(".abc")) {
      parseABC(new Uint8Array(read(file, "binary")));
    }
    return true;
  }

  function createSecurityDomain(builtinABCPath: string, shellABCPath: string, libraryPathInfo): ISecurityDomain {
    var buffer = read(builtinABCPath, 'binary');
    var securityDomain = <ISecurityDomain>new AVMX.SecurityDomain();
    var builtinABC = new ABCFile(new Uint8Array(buffer));
    securityDomain.system.loadABC(builtinABC);
    securityDomain.addCatalog(loadPlayerGlobalCatalog());
    securityDomain.initialize();
    securityDomain.system.executeABC(builtinABC);
    return securityDomain;
  }

  function loadPlayerGlobalCatalog(): AVMX.ABCCatalog {
    var abcs = read(playerglobalInfo.abcs, 'binary');
    var index = JSON.parse(read(playerglobalInfo.catalog));
    return new AVMX.ABCCatalog(abcs, index);
  }
}

Shumway.Shell.main(commandLineArguments);
