/*
 * Copyright 2014 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


module Shumway.AVM1 {
  import isNumeric = Shumway.isNumeric;
  import notImplemented = Shumway.Debug.notImplemented;
  import Option = Shumway.Options.Option;
  import OptionSet = Shumway.Options.OptionSet;
  import Telemetry = Shumway.Telemetry;
  import assert = Shumway.Debug.assert;

  declare var Proxy;
  declare class Error {
    constructor(obj: string);
  }
  declare class InternalError extends Error {
    constructor(obj: string);
  }

  import shumwayOptions = Shumway.Settings.shumwayOptions;

  var avm1Options = shumwayOptions.register(new OptionSet("AVM1"));
  export var avm1TraceEnabled = avm1Options.register(new Option("t1", "traceAvm1", "boolean", false, "trace AVM1 execution"));
  export var avm1ErrorsEnabled = avm1Options.register(new Option("e1", "errorsAvm1", "boolean", false, "fail on AVM1 warnings and errors"));
  export var avm1TimeoutDisabled = avm1Options.register(new Option("ha1", "nohangAvm1", "boolean", false, "disable fail on AVM1 hang"));
  export var avm1CompilerEnabled = avm1Options.register(new Option("ca1", "compileAvm1", "boolean", true, "compiles AVM1 code"));
  export var avm1DebuggerEnabled = avm1Options.register(new Option("da1", "debugAvm1", "boolean", false, "allows AVM1 code debugging"));

  export var Debugger = {
    pause: false,
    breakpoints: {}
  };

  function avm1Warn(message: string, arg1?: any, arg2?: any, arg3?: any, arg4?: any) {
    if (avm1ErrorsEnabled.value) {
      try {
        throw new Error(message); // using throw as a way to break in browsers debugger
      } catch (e) { /* ignoring since handled */ }
    }
    console.warn.apply(console, arguments);
  }

  var MAX_AVM1_HANG_TIMEOUT = 1000;
  var CHECK_AVM1_HANG_EVERY = 1000;
  var MAX_AVM1_ERRORS_LIMIT = 1000;
  var MAX_AVM1_STACK_LIMIT = 256;

  var as2IdentifiersDictionary = [
    "addCallback", "addListener", "addProperty", "addRequestHeader",
    "AsBroadcaster", "attachAudio", "attachMovie", "attachSound", "attachVideo",
    "beginFill", "beginGradientFill", "blendMode", "blockIndent",
    "broadcastMessage", "cacheAsBitmap", "CASEINSENSITIVE", "charAt",
    "charCodeAt", "checkPolicyFile", "clearInterval", "clearRequestHeaders",
    "concat", "createEmptyMovieClip", "curveTo", "DESCENDING", "displayState",
    "duplicateMovieClip", "E", "endFill", "exactSettings", "fromCharCode",
    "fullScreenSourceRect", "getBounds", "getBytesLoaded", "getBytesTotal",
    "getDate", "getDay", "getDepth", "getDepth", "getDuration", "getFullYear",
    "getHours", "getLocal", "getMilliseconds", "getMinutes", "getMonth",
    "getNewTextFormat", "getPan", "getPosition", "getRGB", "getSeconds",
    "getSize", "getTextFormat", "getTime", "getTimezoneOffset", "getTransform",
    "getUTCDate", "getUTCDay", "getUTCFullYear", "getUTCHours",
    "getUTCMilliseconds", "getUTCMinutes", "getUTCMonth", "getUTCSeconds",
    "getUTCYear", "getVolume", "getYear", "globalToLocal", "gotoAndPlay",
    "gotoAndStop", "hasAccessibility", "hasAudio", "hasAudioEncoder",
    "hasEmbeddedVideo", "hasIME", "hasMP3", "hasOwnProperty", "hasPrinting",
    "hasScreenBroadcast", "hasScreenPlayback", "hasStreamingAudio",
    "hasStreamingVideo", "hasVideoEncoder", "hitTest", "indexOf", "isActive",
    "isDebugger", "isFinite", "isNaN", "isPropertyEnumerable", "isPrototypeOf",
    "lastIndexOf", "leftMargin", "letterSpacing", "lineStyle", "lineTo", "LN10",
    "LN10E", "LN2", "LN2E", "loadSound", "localFileReadDisable", "localToGlobal",
    "MAX_VALUE", "MIN_VALUE", "moveTo", "NaN", "NEGATIVE_INFINITY", "nextFrame",
    "NUMERIC", "onChanged", "onData", "onDragOut", "onDragOver", "onEnterFrame",
    "onFullScreen", "onKeyDown", "onKeyUp", "onKillFocus", "onLoad",
    "onMouseDown", "onMouseMove", "onMouseUp", "onPress", "onRelease",
    "onReleaseOutside", "onResize", "onResize", "onRollOut", "onRollOver",
    "onScroller", "onSetFocus", "onStatus", "onSync", "onUnload", "parseFloat",
    "parseInt", "PI", "pixelAspectRatio", "playerType", "POSITIVE_INFINITY",
    "prevFrame", "registerClass", "removeListener", "removeMovieClip",
    "removeTextField", "replaceSel", "RETURNINDEXEDARRAY", "rightMargin",
    "scale9Grid", "scaleMode", "screenColor", "screenDPI", "screenResolutionX",
    "screenResolutionY", "serverString", "setClipboard", "setDate", "setDuration",
    "setFps", "setFullYear", "setHours", "setInterval", "setMask",
    "setMilliseconds", "setMinutes", "setMonth", "setNewTextFormat", "setPan",
    "setPosition", "setRGB", "setSeconds", "setTextFormat", "setTime",
    "setTimeout", "setTransform", "setTransform", "setUTCDate", "setUTCFullYear",
    "setUTCHours", "setUTCMilliseconds", "setUTCMinutes", "setUTCMonth",
    "setUTCSeconds", "setVolume", "setYear", "showMenu", "showRedrawRegions",
    "sortOn", "SQRT1_2", "SQRT2", "startDrag", "stopDrag", "swapDepths",
    "tabEnabled", "tabIndex", "tabIndex", "tabStops", "toLowerCase", "toString",
    "toUpperCase", "trackAsMenu", "UNIQUESORT", "updateAfterEvent",
    "updateProperties", "useCodepage", "useHandCursor", "UTC", "valueOf"];
  var as2IdentifiersCaseMap: MapObject<string> = null;

  class AVM1ScopeListItem {
    constructor(public scope, public next: AVM1ScopeListItem) {
    }

    create(scope) {
      return new AVM1ScopeListItem(scope, this);
    }
  }

  class AVM1CallFrame {
    public inSequence: boolean;

    public calleeThis: AVM1Object;
    public calleeSuper: AVM1Object; // set if super call was used
    public calleeFn: AVM1Function;
    public calleeArgs: any[];

    constructor(public previousFrame: AVM1CallFrame, public currentThis: AVM1Object, public fn: AVM1Function, public args: any[]) {
      this.inSequence = !previousFrame ? false :
        (previousFrame.calleeThis === currentThis && previousFrame.calleeFn === fn);

      this.resetCallee();
    }

    setCallee(thisArg: AVM1Object, superArg: AVM1Object, fn: AVM1Function, args: any[]) {
      this.calleeThis = thisArg;
      this.calleeSuper = superArg;
      this.calleeFn = fn;
      this.calleeArgs = args;
    }

    resetCallee() {
      this.calleeThis = null;
      this.calleeSuper = null;
      this.calleeFn = null;
    }
  }

  class AVM1ContextImpl extends AVM1Context {
    initialScope: AVM1ScopeListItem;
    isActive: boolean;
    executionProhibited: boolean;
    abortExecutionAt: number;
    stackDepth: number;
    frame: AVM1CallFrame;
    isTryCatchListening: boolean;
    errorsIgnored: number;
    deferScriptExecution: boolean;
    pendingScripts;
    defaultTarget;
    currentTarget;
    actions: Lib.AVM1NativeActions;

    private assets: MapObject<number>;
    private assetsSymbols: Array<any>;
    private assetsClasses: Array<any>;
    private eventObservers: MapObject<IAVM1EventPropertyObserver[]>;

    constructor(loaderInfo: Shumway.AVMX.AS.flash.display.LoaderInfo) {
      var swfVersion = loaderInfo.swfVersion;
      super(swfVersion);

      this.loaderInfo = loaderInfo;
      this.sec = loaderInfo.sec; // REDUX:
      this.globals = Lib.AVM1Globals.createGlobalsObject(this);
      this.actions = new Lib.AVM1NativeActions(this);
      this.initialScope = new AVM1ScopeListItem(this.globals, null);
      this.assets = {};
      // TODO: remove this list and always retrieve symbols from LoaderInfo.
      this.assetsSymbols = [];
      this.assetsClasses = [];
      this.isActive = false;
      this.executionProhibited = false;
      this.abortExecutionAt = 0;
      this.stackDepth = 0;
      this.frame = null;
      this.isTryCatchListening = false;
      this.errorsIgnored = 0;
      this.deferScriptExecution = true;
      this.pendingScripts = [];
      this.eventObservers = Object.create(null);

      var context = this;
      this.utils = {
        hasProperty(obj, name) {
          return as2HasProperty(context, obj, name);
        },
        getProperty(obj, name) {
          return as2GetProperty(context, obj, name);
        },
        setProperty(obj, name, value) {
          return as2SetProperty(context, obj, name, value);
        }
      };
    }
    addAsset(className: string, symbolId: number, symbolProps) {
      release || Debug.assert(typeof className === 'string' && !isNaN(symbolId));
      this.assets[className.toLowerCase()] = symbolId;
      this.assetsSymbols[symbolId] = symbolProps;
    }
    registerClass(className: string, theClass) {
      className = alCoerceString(this, className);
      if (className === null) {
        avm1Warn('Cannot register class for symbol: className is missing');
        return null;
      }
      var symbolId = this.assets[className.toLowerCase()];
      if (symbolId === undefined) {
        avm1Warn('Cannot register ' + className + ' class for symbol');
        return;
      }
      this.assetsClasses[symbolId] = theClass;
    }
    getAsset(className: string) : AVM1ExportedSymbol {
      className = alCoerceString(this, className);
      if (className === null) {
        return undefined;
      }
      var symbolId = this.assets[className.toLowerCase()];
      if (symbolId === undefined) {
        return undefined;
      }
      var symbol = this.assetsSymbols[symbolId];
      if (!symbol) {
        symbol = this.loaderInfo.getSymbolById(symbolId);
        if (!symbol) {
          Debug.warning("Symbol " + symbolId + " is not defined.");
          return undefined;
        }
        this.assetsSymbols[symbolId] = symbol;
      }
      return {
        symbolId: symbolId,
        symbolProps: symbol,
        theClass: this.assetsClasses[symbolId]
      };
    }
    resolveTarget(target: any) : any {
      var result: AVM1Object;
      if (target instanceof AVM1Object && target.isAVM1Instance) {
        result = target;
      } else if (!isNullOrUndefined(target)) {
        result = this.lookupChild(alToString(this, target), true);
        if (!(result instanceof AVM1Object) || !(<any>result).isAVM1Instance) {
          throw new Error('Invalid AVM1 target object: ' + alToString(this, result));
        }
      } else {
        result = this.currentTarget || this.defaultTarget;
      }
      return result;
    }
    resolveLevel(level: number) : any {
      // TODO levels 1, 2, etc.
      // TODO _lockroot
      if (level === 0) {
        return this.root;
      }
      return undefined;
    }
    lookupChild(targetPath: string, fromCurrentTarget: boolean): AVM1Object {
      var path: string[];
      var obj: AVM1Object = this.defaultTarget;
      if (fromCurrentTarget && this.currentTarget) {
        obj = this.currentTarget;
      }

      // special cases
      if (!targetPath || targetPath === '.') {
        return obj;
      } else if (targetPath === '..') {
        return obj.alGet('_parent');
      }

      if (targetPath.indexOf('/') >= 0) {
        // Parsing legacy format, e.g. /A/B
        path = targetPath.split('/');
        if (path[0] === '') { // starts from root
          path[0] === '_root';
        }
        for (var i = 0; i < path.length; i++) {
          if (path[i] === '.' || path[i] === '') { // points to current child
            path.splice(i, 1);
          } else if (path[i] === '..') { // points to parent
            path[i] === '_parent';
          }
        }
      } else {
        // Parsing simple dot notation, e.g. A.B
        path = targetPath.split('.');
      }

      if (path[0] === '_level0' || path[0] === '_root') {
        // Optimizing first item access
        obj = this.resolveLevel(0);
        path.shift();
      }

      while (path.length > 0) {
        var prevObj = obj;
        obj = isAVM1MovieClip(obj) ? (<Lib.AVM1MovieClip>obj)._lookupChildByName(path[0]) : null;
        if (!obj) {
          avm1Warn(path[0] + ' (expr ' + targetPath + ') is not found in ' +
            (<Lib.AVM1MovieClip>prevObj)._target);
          // TODO refactor me
          return new AVM1Object(this); // resolving to fake object
        }
        path.shift();
      }
      return obj;
    }
    addToPendingScripts(fn: Function, defaultTarget: any) {
      var runner = function () {
        var savedIsActive = this.isActive;
        if (!savedIsActive) {
          this.isActive = true;
          this.abortExecutionAt = avm1TimeoutDisabled.value ?
            Number.MAX_VALUE : Date.now() + MAX_AVM1_HANG_TIMEOUT;
          this.errorsIgnored = 0;
        }
        var savedDefaultTarget = this.defaultTarget;
        var savedCurrentTarget = this.currentTarget;
        this.defaultTarget = defaultTarget;
        this.currentTarget = null;
        var caughtError;
        try {
          fn();
        } catch (e) {
          caughtError = e;
        }
        this.defaultTarget = savedDefaultTarget;
        this.currentTarget = savedCurrentTarget;
        if (caughtError) {
          // Note: this doesn't use `finally` because that's a no-go for performance.
          throw caughtError;
        }
      }.bind(this);
      if (!this.deferScriptExecution) {
        runner();
        return;
      }
      this.pendingScripts.push(runner);
    }
    flushPendingScripts() {
      var scripts = this.pendingScripts;
      while (scripts.length) {
        scripts.shift()();
      }
      this.deferScriptExecution = false;
    }
    pushCallFrame(thisArg: AVM1Object, fn: AVM1Function, args: any[]) : AVM1CallFrame {
      var nextFrame = new AVM1CallFrame(this.frame, thisArg, fn, args);
      this.frame = nextFrame;
      return nextFrame;
    }
    popCallFrame() {
      var previousFrame = this.frame.previousFrame;
      this.frame = previousFrame;
      return previousFrame;
    }
    executeActions(actionsData: AVM1ActionsData, scopeObj): void {
      if (this.executionProhibited) {
        return; // no more avm1 for this context
      }

      var savedIsActive = this.isActive;
      if (!savedIsActive) {
        this.isActive = true;
        this.abortExecutionAt = avm1TimeoutDisabled.value ?
          Number.MAX_VALUE : Date.now() + MAX_AVM1_HANG_TIMEOUT;
        this.errorsIgnored = 0;
      }
      var caughtError;
      try {
        executeActionsData(this, actionsData, scopeObj);
      } catch (e) {
        caughtError = e;
      }
      this.isActive = false;
      if (caughtError) {
        // Note: this doesn't use `finally` because that's a no-go for performance.
        throw caughtError;
      }
    }
    public registerEventPropertyObserver(propertyName: string, observer: IAVM1EventPropertyObserver) {
      // TODO case insensitive SWF5
      var observers = this.eventObservers[propertyName];
      if (!observers) {
        observers = [];
        this.eventObservers[propertyName] = observers;
      }
      observers.push(observer);
    }
    public unregisterEventPropertyObserver(propertyName: string, observer: IAVM1EventPropertyObserver) {
      var observers = this.eventObservers[propertyName];
      if (!observers) {
        return;
      }
      var j = observers.indexOf(observer);
      if (j < 0) {
        return;
      }
      observers.splice(j, 1);
    }
    broadcastEventPropertyChange(propertyName) {
      var observers = this.eventObservers[propertyName];
      if (!observers) {
        return;
      }
      observers.forEach((observer: IAVM1EventPropertyObserver) => observer.onEventPropertyModified(propertyName));
    }
  }

  AVM1Context.create = function(loaderInfo: Shumway.AVMX.AS.flash.display.LoaderInfo): AVM1Context {
    return new AVM1ContextImpl(loaderInfo);
  };

  class AVM1Error {
    constructor(public error) {}
  }

  class AVM1CriticalError extends Error  {
    constructor(message: string, public error?) {
      super(message);
    }
  }

  function isAVM1MovieClip(obj): boolean {
    return typeof obj === 'object' && obj &&
      obj instanceof Lib.AVM1MovieClip;
  }

  function as2GetType(v): string {
    if (v === null) {
      return 'null';
    }

    var type = typeof v;
    if (type === 'function') {
      return 'object';
    }
    if (type === 'object' && isAVM1MovieClip(v)) {
      return 'movieclip';
    }
    return type;
  }

  function as2ToAddPrimitive(context: AVM1Context, value: any): any {
    return alToPrimitive(context, value);
  }

  function as2Compare(context: AVM1Context, x, y): boolean {
    var x2 = alToPrimitive(context, x);
    var y2 = alToPrimitive(context, y);
    if (typeof x2 === 'string' && typeof y2 === 'string') {
      var xs = alToString(context, x2), ys = alToString(context, y2);
      return xs < ys;
    } else {
      var xn = alToNumber(context, x2), yn = alToNumber(context, y2);
      return isNaN(xn) || isNaN(yn) ? undefined : xn < yn;
    }
  }

  function as2InstanceOf(obj, constructor): boolean {
    // TODO refactor this -- quick and dirty hack for now
    if (isNullOrUndefined(obj) || isNullOrUndefined(constructor)) {
      return false;
    }

    if (constructor === Shumway.AVMX.AS.ASString) {
      return typeof obj === 'string';
    } else if (constructor === Shumway.AVMX.AS.ASNumber) {
      return typeof obj === 'number';
    } else if (constructor === Shumway.AVMX.AS.ASBoolean) {
      return typeof obj === 'boolean';
    } else if (constructor === Shumway.AVMX.AS.ASArray) {
      return Array.isArray(obj);
    } else if (constructor === Shumway.AVMX.AS.ASFunction) {
      return typeof obj === 'function';
    } else if (constructor === Shumway.AVMX.AS.ASObject) {
      return typeof obj === 'object';
    }

    var baseProto = constructor.alGetPrototypeProperty();
    if (!baseProto) {
      return false;
    }
    var proto = obj;
    while (proto) {
      if (proto === baseProto) {
        return true; // found the type if the chain
      }
      proto = proto.alPrototype;
    }
    // TODO interface check
    return false;
  }

  interface ResolvePropertyResult {
    link: AVM1Object;
    name;
  }

  // internal cachable results to avoid GC
  var __resolvePropertyResult: ResolvePropertyResult = {
    link: null,
    name: null
  };

  function as2HasProperty(context: AVM1Context, obj: any, name: any): boolean {
    var avm1Obj: AVM1Object = alToObject(context, obj);
    return avm1Obj.alHasProperty(name);
  }

  function as2GetProperty(context: AVM1Context, obj: any, name: any): any {
    var avm1Obj: AVM1Object = alToObject(context, obj);
    return avm1Obj.alGet(name);
  }

  function as2SetProperty(context: AVM1Context, obj: any, name: any, value: any): void {
    var avm1Obj: AVM1Object = alToObject(context, obj);
    avm1Obj.alPut(name, value);
    as2SyncEvents(context, name);
  }

  function as2DeleteProperty(context: AVM1Context, obj: any, name: any): any {
    var avm1Obj: AVM1Object = alToObject(context, obj);
    var result = avm1Obj.alDeleteProperty(name);
    as2SyncEvents(context, name);
    return result;
  }

  function as2SyncEvents(context: AVM1Context, name): void {
    name = alCoerceString(context, name);
    if (name[0] !== 'o' || name[1] !== 'n') { // TODO check case?
      return;
    }
    // Maybe an event property, trying to broadcast change.
    (<AVM1ContextImpl>context).broadcastEventPropertyChange(name);
  }

  function as2CastError(ex) {
    if (typeof InternalError !== 'undefined' &&
        ex instanceof InternalError && (<any>ex).message === 'too much recursion') {
      // HACK converting too much recursion into AVM1CriticalError
      return new AVM1CriticalError('long running script -- AVM1 recursion limit is reached');
    }
    return ex;
  }

  function as2Construct(ctor, args) {
    var result;
    if (alIsFunction(ctor)) {
      result = (<AVM1Function>ctor).alConstruct(args);
    } else {
      // AVM1 simply ignores attempts to invoke non-methods.
      return undefined;
    }
    return result;
  }

  function as2Enumerate(obj, fn: (name) => void, thisArg): void {
    var processed = Object.create(null); // TODO remove/refactor
    alForEachProperty(obj, function (name) {
      if (processed[name]) {
        return; // skipping already reported properties
      }
      fn.call(thisArg, name);
      processed[name] = true;
    }, thisArg);
  }

  function avm1FindSuperPropertyOwner(context: AVM1Context, frame: AVM1CallFrame, propertyName: string): AVM1Object {
    if (context.swfVersion < 6) {
      return null;
    }

    var proto: AVM1Object = (frame.inSequence && frame.previousFrame.calleeSuper);
    if (!proto) {
      // Finding first object in prototype chain link that has the property.
      proto = frame.currentThis;
      while (proto && !proto.alHasOwnProperty(propertyName)) {
        proto = proto.alPrototype;
      }
      if (!proto) {
        return null;
      }
    }

    // Skipping one chain link
    proto = proto.alPrototype;
    return proto;
  }

  function executeActionsData(context: AVM1ContextImpl, actionsData: AVM1ActionsData, scope) {
    var actionTracer = ActionTracerFactory.get();
    var registers = [];
    registers.length = 4; // by default only 4 registers allowed

    var scopeContainer = context.initialScope.create(scope);
    var caughtError;
    context.pushCallFrame(scope, null, null);
    actionTracer.message('ActionScript Execution Starts');
    actionTracer.indent();

    var savedDefaultTarget = context.defaultTarget;
    var savedCurrentTarget = context.currentTarget;

    context.defaultTarget = scope;
    context.currentTarget = null;
    try {
      interpretActionsData(context, actionsData, scopeContainer, [], registers);
    } catch (e) {
      caughtError = as2CastError(e);
    }
    context.defaultTarget = savedDefaultTarget;
    context.currentTarget = savedCurrentTarget;


    if (caughtError instanceof AVM1CriticalError) {
      context.executionProhibited = true;
      console.error('Disabling AVM1 execution');
    }
    context.popCallFrame();
    actionTracer.unindent();
    actionTracer.message('ActionScript Execution Stops');
    if (caughtError) {
      // Note: this doesn't use `finally` because that's a no-go for performance.
      throw caughtError; // TODO shall we just ignore it?
    }
  }

  function createBuiltinType(context: AVM1Context, cls, args: any[]): any {
    var builtins = context.builtins;
    var obj = undefined;
    if (cls === builtins.Array || cls === builtins.Object ||
        cls === builtins.Date) {
       obj = cls.alConstruct(args);
    }
    if (cls === builtins.Boolean || cls === builtins.Number ||
        cls === builtins.String || cls === builtins.Function) {
      obj = cls.alConstruct(args).value;
    }
    if (obj instanceof AVM1Object) {
      (<AVM1Object>obj).alSetOwnProperty('__constructor__', {
        flags: AVM1PropertyFlags.DATA | AVM1PropertyFlags.DONT_ENUM,
        value: cls
      });
    }
    return undefined;
  }

  class AVM1SuperWrapper extends AVM1Object {
    public constructor(context: AVM1Context, public callFrame: AVM1CallFrame) {
      super(context);
    }
  }

  interface ExecutionContext {
    context: AVM1ContextImpl;
    actions: Lib.AVM1NativeActions;
    scopeContainer: AVM1ScopeListItem;
    scope: any;
    actionTracer: ActionTracer;
    constantPool: any;
    registers: any[];
    stack: any[];
    frame: AVM1CallFrame;
    isSwfVersion5: boolean;
    recoveringFromError: boolean;
    isEndOfActions: boolean;
  }

    function fixArgsCount(numArgs: number /* int */, maxAmount: number): number {
      if (isNaN(numArgs) || numArgs < 0) {
        avm1Warn('Invalid amount of arguments: ' + numArgs);
        return 0;
      }
      numArgs |= 0;
      if (numArgs > maxAmount) {
        avm1Warn('Truncating amount of arguments: from ' + numArgs + ' to ' + maxAmount);
        return maxAmount;
      }
      return numArgs;
    }
    function avm1ReadFunctionArgs(stack: any[]) {
      var numArgs = +stack.pop();
      numArgs = fixArgsCount(numArgs, stack.length);
      var args = [];
      for (var i = 0; i < numArgs; i++) {
        args.push(stack.pop());
      }
      return args;
    }
    function avm1SetTarget(ectx: ExecutionContext, targetPath: string) {
      var currentContext = ectx.context;

      if (!targetPath) {
        currentContext.currentTarget = null;
        return;
      }

      try {
        currentContext.currentTarget = currentContext.lookupChild(targetPath, false);
      } catch (e) {
        currentContext.currentTarget = null;
        throw e;
      }
    }
    function isGlobalObject(obj) {
      return obj === this;
    }

    function avm1DefineFunction(ectx: ExecutionContext,
                                actionsData: AVM1ActionsData,
                                functionName: string,
                                parametersNames: string[],
                                registersCount: number,
                                registersAllocation: ArgumentAssignment[],
                                suppressArguments: ArgumentAssignmentType): AVM1Function {
      var currentContext = ectx.context;
      var scopeContainer = ectx.scopeContainer;
      var scope = ectx.scope;
      var actionTracer = ectx.actionTracer;
      var defaultTarget = currentContext.defaultTarget;
      var constantPool = ectx.constantPool;

      var skipArguments = null;
      var registersAllocationCount = !registersAllocation ? 0 : registersAllocation.length;
      for (var i = 0; i < registersAllocationCount; i++) {
        var registerAllocation = registersAllocation[i];
        if (registerAllocation &&
            registerAllocation.type === ArgumentAssignmentType.Argument) {
          if (!skipArguments) {
            skipArguments = [];
          }
          skipArguments[registersAllocation[i].index] = true;
        }
      }

      var registersLength = Math.min(registersCount, 255); // max allowed for DefineFunction2
      registersLength = Math.max(registersLength, registersAllocationCount + 1);

      var cachedRegisters = [];
      var MAX_CACHED_REGISTERS = 10;
      function createRegisters() {
        if (cachedRegisters.length > 0) {
          return cachedRegisters.pop();
        }
        var registers = [];
        registers.length = registersLength;
        return registers;
      }
      function disposeRegisters(registers) {
        if (cachedRegisters.length > MAX_CACHED_REGISTERS) {
          return;
        }
        cachedRegisters.push(registers);
      }

      var fn = (function() {
        if (currentContext.executionProhibited) {
          return; // no more avm1 execution, ever
        }

        var newScopeContainer;
        // Builds function closure (it shall return 'this' in toString).
        var newScope: any = new AVM1Object(currentContext);
        newScope.alPut('toString', new AVM1NativeFunction(currentContext, function () {
          return this;
        }));

        var thisArg = isGlobalObject(this) ? scope : this;
        var argumentsClone;
        var supperWrapper;

        var frame = currentContext.pushCallFrame(thisArg, fnObj, <any>arguments);

        if (!(suppressArguments & ArgumentAssignmentType.Arguments)) {
          argumentsClone = Array.prototype.slice.call(arguments, 0);
          newScope.alPut('arguments', argumentsClone);
        }
        if (!(suppressArguments & ArgumentAssignmentType.This)) {
          newScope.alPut('this', thisArg);
        }
        if (!(suppressArguments & ArgumentAssignmentType.Super)) {
          supperWrapper = new AVM1SuperWrapper(currentContext, frame);
          newScope.alPut('super', supperWrapper);
        }
        newScopeContainer = scopeContainer.create(newScope);
        var i;
        var registers = createRegisters();
        for (i = 0; i < registersAllocationCount; i++) {
          var registerAllocation = registersAllocation[i];
          if (registerAllocation) {
            switch (registerAllocation.type) {
              case ArgumentAssignmentType.Argument:
                registers[i] = arguments[registerAllocation.index];
                break;
              case ArgumentAssignmentType.This:
                registers[i] = thisArg;
                break;
              case ArgumentAssignmentType.Arguments:
                argumentsClone = argumentsClone || Array.prototype.slice.call(arguments, 0);
                registers[i] = argumentsClone;
                break;
              case ArgumentAssignmentType.Super:
                supperWrapper = supperWrapper || new AVM1SuperWrapper(currentContext, frame);
                registers[i] = supperWrapper;
                break;
              case ArgumentAssignmentType.Global:
                registers[i] = currentContext.globals;
                break;
              case ArgumentAssignmentType.Parent:
                registers[i] = scope.alGet('_parent');
                break;
              case ArgumentAssignmentType.Root:
                registers[i] = currentContext.resolveLevel(0);
                break;
            }
          }
        }
        for (i = 0; i < arguments.length || i < parametersNames.length; i++) {
          if (skipArguments && skipArguments[i]) {
            continue;
          }
          newScope.alPut(parametersNames[i], arguments[i]);
        }

        var result;
        var caughtError;
        actionTracer.indent();
        if (++currentContext.stackDepth >= MAX_AVM1_STACK_LIMIT) {
          throw new AVM1CriticalError('long running script -- AVM1 recursion limit is reached');
        }

        var savedCurrentTarget = currentContext.currentTarget;
        currentContext.currentTarget = null;
        try {
          result = interpretActionsData(currentContext, actionsData, newScopeContainer, constantPool, registers);
        } catch (e) {
          caughtError = e;
        }
        currentContext.currentTarget = savedCurrentTarget;

        currentContext.stackDepth--;
        currentContext.popCallFrame();
        actionTracer.unindent();
        disposeRegisters(registers);
        if (caughtError) {
          // Note: this doesn't use `finally` because that's a no-go for performance.
          throw caughtError;
        }
        return result;
      });

      var fnObj: AVM1Function = new AVM1EvalFunction(currentContext, fn);
      (<any>fn).debugName = 'avm1 ' + (functionName || '<function>');
      if (functionName) {
        (<any>fn).name = functionName;
      }
      return fnObj;
    }

    function avm1VariableNameHasPath(variableName: string): boolean {
      return variableName && (variableName.indexOf('.') >= 0 || variableName.indexOf(':') >= 0);
    }

    function avm1FindChildVariableScope(ectx: ExecutionContext, variableName: string): AVM1Object {
      var currentContext = ectx.context;
      var obj, name, i;
      if (variableName.indexOf(':') >= 0) {
        // "/A/B:FOO references the FOO variable in the movie clip with a target path of /A/B."
        var parts = variableName.split(':');
        obj = currentContext.lookupChild(parts[0], true);
        if (!obj) {
          avm1Warn(parts[0] + ' is undefined');
          return null;
        }
        name = parts[1];
      } else if (variableName.indexOf('.') >= 0) {
        // new object reference
        var objPath = variableName.split('.');
        name = objPath.pop();
        obj = currentContext.globals;
        for (i = 0; i < objPath.length; i++) {
          if (obj.alHasProperty(objPath[i])) {
            avm1Warn(objPath.slice(0, i + 1) + ' is undefined');
            return null;
          }
          obj = alToObject(currentContext, obj.alGet(objPath[i]));
        }
      } else {
        release || Debug.assert(false, 'AVM1 variable has no path');
      }

      return obj;
    }

    function avm1FindGetVariableScope(ectx: ExecutionContext, variableName: string): AVM1Object {
      if (avm1VariableNameHasPath(variableName)) {
        return avm1FindChildVariableScope(ectx, variableName);
      }

      var scopeContainer = ectx.scopeContainer;
      var currentContext = ectx.context;
      var currentTarget = currentContext.currentTarget;
      var scope = ectx.scope;

      if (currentTarget &&
          currentTarget.alHasProperty(variableName)) {
        return currentTarget;
      }

      for (var p = scopeContainer; p; p = p.next) {
        if (p.scope.alHasProperty(variableName)) {
          return p.scope;
        }
      }

      // FIXME refactor that
      if (variableName === 'this') {
        scope.alSetOwnProperty('this', {
          flags: AVM1PropertyFlags.NATIVE_MEMBER,
          value: currentContext.defaultTarget,
        });
        return scope;
      }

      return null;
    }
    function avm1FindSetVariableScope(ectx: ExecutionContext, variableName: string): AVM1Object {
      if (avm1VariableNameHasPath(variableName)) {
        return avm1FindChildVariableScope(ectx, variableName);
      }

      var scopeContainer = ectx.scopeContainer;
      var currentContext = ectx.context;
      var currentTarget = currentContext.currentTarget;
      var scope = ectx.scope;

      if (currentTarget) {
        return currentTarget;
      }

      for (var p = scopeContainer; p.next; p = p.next) { // excluding globals
        if (p.scope.alHasProperty(variableName)) {
          return p.scope;
        }
      }

      return scope;
    }

    function avm1ProcessWith(ectx: ExecutionContext, obj, withBlock) {
      var scopeContainer = ectx.scopeContainer;
      var constantPool = ectx.constantPool;
      var registers = ectx.registers;

      var newScopeContainer = scopeContainer.create(Object(obj));
      interpretActionsData(ectx.context, withBlock, newScopeContainer, constantPool, registers);
    }
    function avm1ProcessTry(ectx: ExecutionContext,
                            catchIsRegisterFlag, finallyBlockFlag,
                            catchBlockFlag, catchTarget,
                            tryBlock, catchBlock, finallyBlock) {
      var currentContext = ectx.context;
      var scopeContainer = ectx.scopeContainer;
      var scope = ectx.scope;
      var constantPool = ectx.constantPool;
      var registers = ectx.registers;

      var savedTryCatchState = currentContext.isTryCatchListening;
      var caughtError;
      try {
        currentContext.isTryCatchListening = true;
        interpretActionsData(currentContext, tryBlock, scopeContainer, constantPool, registers);
      } catch (e) {
        currentContext.isTryCatchListening = savedTryCatchState;
        if (!catchBlockFlag || !(e instanceof AVM1Error)) {
          caughtError = e;
        } else {
          if (typeof catchTarget === 'string') { // TODO catchIsRegisterFlag?
            scope.alPut(catchTarget, e.error);
          } else {
            registers[catchTarget] = e.error;
          }
          interpretActionsData(currentContext, catchBlock, scopeContainer, constantPool, registers);
        }
      }
      currentContext.isTryCatchListening = savedTryCatchState;
      if (finallyBlockFlag) {
        interpretActionsData(currentContext, finallyBlock, scopeContainer, constantPool, registers);
      }
      if (caughtError) {
        throw caughtError;
      }
    }

    // SWF 3 actions
    function avm1_0x81_ActionGotoFrame(ectx: ExecutionContext, args: any[]) {
      var frame: number = args[0];
      var play: boolean = args[1];
      if (play) {
        ectx.actions.gotoAndPlay(frame + 1);
      } else {
        ectx.actions.gotoAndStop(frame + 1);
      }
    }
    function avm1_0x83_ActionGetURL(ectx: ExecutionContext, args: any[]) {
      var actions = ectx.actions;

      var urlString: string = args[0];
      var targetString: string = args[1];
      ectx.actions.getURL(urlString, targetString);
    }
    function avm1_0x04_ActionNextFrame(ectx: ExecutionContext) {
      ectx.actions.nextFrame();
    }
    function avm1_0x05_ActionPreviousFrame(ectx: ExecutionContext) {
      ectx.actions.prevFrame();
    }
    function avm1_0x06_ActionPlay(ectx: ExecutionContext) {
      ectx.actions.play();
    }
    function avm1_0x07_ActionStop(ectx: ExecutionContext) {
      ectx.actions.stop();
    }
    function avm1_0x08_ActionToggleQuality(ectx: ExecutionContext) {
      ectx.actions.toggleHighQuality();
    }
    function avm1_0x09_ActionStopSounds(ectx: ExecutionContext) {
      ectx.actions.stopAllSounds();
    }
    function avm1_0x8A_ActionWaitForFrame(ectx: ExecutionContext, args: any[]) {
      var frame: number = args[0];
      var count: number = args[1];
      return !ectx.actions.ifFrameLoaded(frame);
    }
    function avm1_0x8B_ActionSetTarget(ectx: ExecutionContext, args: any[]) {
      var targetName: string = args[0];
      avm1SetTarget(ectx, targetName);
    }
    function avm1_0x8C_ActionGoToLabel(ectx: ExecutionContext, args: any[]) {
      var label: string = args[0];
      var play: boolean = args[1];
      if (play) {
        ectx.actions.gotoAndPlay(label);
      } else {
        ectx.actions.gotoAndStop(label);
      }
    }
    // SWF 4 actions
    function avm1_0x96_ActionPush(ectx: ExecutionContext, args: any[]) {
      var registers = ectx.registers;
      var constantPool = ectx.constantPool;
      var stack = ectx.stack;

      args.forEach(function (value) {
        if (value instanceof ParsedPushConstantAction) {
          stack.push(constantPool[(<ParsedPushConstantAction> value).constantIndex]);
        } else if (value instanceof ParsedPushRegisterAction) {
          var registerNumber = (<ParsedPushRegisterAction> value).registerNumber;
          if (registerNumber < 0 || registerNumber >= registers.length) {
            stack.push(undefined);
          } else {
            stack.push(registers[registerNumber]);
          }
        } else {
          stack.push(value);
        }
      });
    }
    function avm1_0x17_ActionPop(ectx: ExecutionContext) {
      var stack = ectx.stack;

      stack.pop();
    }
    function avm1_0x0A_ActionAdd(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var a = alToNumber(ectx.context, stack.pop());
      var b = alToNumber(ectx.context, stack.pop());
      stack.push(a + b);
    }
    function avm1_0x0B_ActionSubtract(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var a = alToNumber(ectx.context, stack.pop());
      var b = alToNumber(ectx.context, stack.pop());
      stack.push(b - a);
    }
    function avm1_0x0C_ActionMultiply(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var a = alToNumber(ectx.context, stack.pop());
      var b = alToNumber(ectx.context, stack.pop());
      stack.push(a * b);
    }
    function avm1_0x0D_ActionDivide(ectx: ExecutionContext) {
      var stack = ectx.stack;
      var isSwfVersion5 = ectx.isSwfVersion5;

      var a = alToNumber(ectx.context, stack.pop());
      var b = alToNumber(ectx.context, stack.pop());
      var c = b / a;
      stack.push(isSwfVersion5 ? <any>c : isFinite(c) ? <any>c : '#ERROR#');
    }
    function avm1_0x0E_ActionEquals(ectx: ExecutionContext) {
      var stack = ectx.stack;
      var isSwfVersion5 = ectx.isSwfVersion5;

      var a = alToNumber(ectx.context, stack.pop());
      var b = alToNumber(ectx.context, stack.pop());
      var f = a == b;
      stack.push(isSwfVersion5 ? <any>f : f ? 1 : 0);
    }
    function avm1_0x0F_ActionLess(ectx: ExecutionContext) {
      var stack = ectx.stack;
      var isSwfVersion5 = ectx.isSwfVersion5;

      var a = alToNumber(ectx.context, stack.pop());
      var b = alToNumber(ectx.context, stack.pop());
      var f = b < a;
      stack.push(isSwfVersion5 ? <any>f : f ? 1 : 0);
    }
    function avm1_0x10_ActionAnd(ectx: ExecutionContext) {
      var stack = ectx.stack;
      var isSwfVersion5 = ectx.isSwfVersion5;

      var a = alToBoolean(ectx.context, stack.pop());
      var b = alToBoolean(ectx.context, stack.pop());
      var f = a && b;
      stack.push(isSwfVersion5 ? <any>f : f ? 1 : 0);
    }
    function avm1_0x11_ActionOr(ectx: ExecutionContext) {
      var stack = ectx.stack;
      var isSwfVersion5 = ectx.isSwfVersion5;

      var a = alToBoolean(ectx.context, stack.pop());
      var b = alToBoolean(ectx.context, stack.pop());
      var f = a || b;
      stack.push(isSwfVersion5 ? <any>f : f ? 1 : 0);
    }
    function avm1_0x12_ActionNot(ectx: ExecutionContext) {
      var stack = ectx.stack;
      var isSwfVersion5 = ectx.isSwfVersion5;

      var f = !alToBoolean(ectx.context, stack.pop());
      stack.push(isSwfVersion5 ? <any>f : f ? 1 : 0);
    }
    function avm1_0x13_ActionStringEquals(ectx: ExecutionContext) {
      var stack = ectx.stack;
      var isSwfVersion5 = ectx.isSwfVersion5;

      var sa = alToString(ectx.context, stack.pop());
      var sb = alToString(ectx.context, stack.pop());
      var f = sa == sb;
      stack.push(isSwfVersion5 ? <any>f : f ? 1 : 0);
    }
    function avm1_0x14_ActionStringLength(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var sa = alToString(ectx.context, stack.pop());
      stack.push(ectx.actions.length_(sa));
    }
    function avm1_0x31_ActionMBStringLength(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var sa = alToString(ectx.context, stack.pop());
      stack.push(ectx.actions.length_(sa));
    }
    function avm1_0x21_ActionStringAdd(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var sa = alToString(ectx.context, stack.pop());
      var sb = alToString(ectx.context, stack.pop());
      stack.push(sb + sa);
    }
    function avm1_0x15_ActionStringExtract(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var count = stack.pop();
      var index = stack.pop();
      var value = alToString(ectx.context, stack.pop());
      stack.push(ectx.actions.substring(value, index, count));
    }
    function avm1_0x35_ActionMBStringExtract(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var count = stack.pop();
      var index = stack.pop();
      var value = alToString(ectx.context, stack.pop());
      stack.push(ectx.actions.mbsubstring(value, index, count));
    }
    function avm1_0x29_ActionStringLess(ectx: ExecutionContext) {
      var stack = ectx.stack;
      var isSwfVersion5 = ectx.isSwfVersion5;

      var sa = alToString(ectx.context, stack.pop());
      var sb = alToString(ectx.context, stack.pop());
      var f = sb < sa;
      stack.push(isSwfVersion5 ? <any>f : f ? 1 : 0);
    }
    function avm1_0x18_ActionToInteger(ectx: ExecutionContext) {
      var stack = ectx.stack;

      stack.push(ectx.actions.int(stack.pop()));
    }
    function avm1_0x32_ActionCharToAscii(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var ch = stack.pop();
      var charCode = ectx.actions.ord(ch);
      stack.push(charCode);
    }
    function avm1_0x36_ActionMBCharToAscii(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var ch = stack.pop();
      var charCode = ectx.actions.mbord(ch);
      stack.push(charCode);
    }
    function avm1_0x33_ActionAsciiToChar(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var charCode = +stack.pop();
      var ch = ectx.actions.chr(charCode);
      stack.push(ch);
    }
    function avm1_0x37_ActionMBAsciiToChar(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var charCode = +stack.pop();
      var ch = ectx.actions.mbchr(charCode);
      stack.push(ch);
    }
    function avm1_0x99_ActionJump(ectx: ExecutionContext, args: any[]) {
      // implemented in the analyzer
    }
    function avm1_0x9D_ActionIf(ectx: ExecutionContext, args: any[]) {
      var stack = ectx.stack;

      var offset: number = args[0];
      return !!stack.pop();
    }
    function avm1_0x9E_ActionCall(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var label = stack.pop();
      ectx.actions.call(label);
    }
    function avm1_0x1C_ActionGetVariable(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var variableName = '' + stack.pop();

      var sp = stack.length;
      stack.push(undefined);

      var resolved = avm1FindGetVariableScope(ectx, variableName);
      if (isNullOrUndefined(resolved)) {
        avm1Warn("AVM1 warning: cannot look up variable '" + variableName + "'");
        return;
      }
      stack[sp] = resolved ? resolved.alGet(variableName) : undefined;
    }
    function avm1_0x1D_ActionSetVariable(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var value = stack.pop();
      var variableName = '' + stack.pop();
      var resolved = avm1FindSetVariableScope(ectx, variableName);
      if (isNullOrUndefined(resolved)) {
        avm1Warn("AVM1 warning: cannot look up variable '" + variableName + "'");
        return;
      }
      if (resolved) {
        resolved.alPut(variableName, value);
        as2SyncEvents(ectx.context, variableName);
      }
    }
    function avm1_0x9A_ActionGetURL2(ectx: ExecutionContext, args: any[]) {
      var stack = ectx.stack;

      var flags: number = args[0];
      var target = stack.pop();
      var url = stack.pop();
      var sendVarsMethod;
      if (flags & 1) {
        sendVarsMethod = 'GET';
      } else if (flags & 2) {
        sendVarsMethod = 'POST';
      }
      var loadTargetFlag = flags & 1 << 6;
      var loadVariablesFlag = flags & 1 << 7;
      if (loadVariablesFlag) {
        ectx.actions.loadVariables(url, target, sendVarsMethod);
      } else if (!loadTargetFlag) {
        ectx.actions.getURL(url, target, sendVarsMethod);
      } else {
        ectx.actions.loadMovie(url, target, sendVarsMethod);
      }
    }
    function avm1_0x9F_ActionGotoFrame2(ectx: ExecutionContext, args: any[]) {
      var stack = ectx.stack;

      var flags: number = args[0];
      var gotoParams = [stack.pop()];
      if (!!(flags & 2)) {
        gotoParams.push(args[1]);
      }
      var gotoMethod = !!(flags & 1) ? ectx.actions.gotoAndPlay : ectx.actions.gotoAndStop;
      gotoMethod.apply(ectx.actions, gotoParams);
    }
    function avm1_0x20_ActionSetTarget2(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var target = stack.pop();
      avm1SetTarget(ectx, target);
    }
    function avm1_0x22_ActionGetProperty(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var index = stack.pop();
      var target = stack.pop();

      var sp = stack.length;
      stack.push(undefined);

      stack[sp] = ectx.actions.getAVM1Property(target, index);
    }
    function avm1_0x23_ActionSetProperty(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var value = stack.pop();
      var index = stack.pop();
      var target = stack.pop();
      ectx.actions.setAVM1Property(target, index, value);
    }
    function avm1_0x24_ActionCloneSprite(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var depth = stack.pop();
      var target = stack.pop();
      var source = stack.pop();
      ectx.actions.duplicateMovieClip(source, target, depth);
    }
    function avm1_0x25_ActionRemoveSprite(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var target = stack.pop();
      ectx.actions.removeMovieClip(target);
    }
    function avm1_0x27_ActionStartDrag(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var target = stack.pop();
      var lockcenter = stack.pop();
      var constrain = !stack.pop() ? null : {
        y2: stack.pop(),
        x2: stack.pop(),
        y1: stack.pop(),
        x1: stack.pop()
      };
      var dragParams = [target, lockcenter];
      if (constrain) {
        dragParams = dragParams.concat(constrain.x1, constrain.y1,
          constrain.x2, constrain.y2);
      }
      ectx.actions.startDrag.apply(ectx.actions, dragParams);
    }
    function avm1_0x28_ActionEndDrag(ectx: ExecutionContext) {
      ectx.actions.stopDrag();
    }
    function avm1_0x8D_ActionWaitForFrame2(ectx: ExecutionContext, args: any[]) {
      var stack = ectx.stack;

      var count: number = args[0];
      var frame = stack.pop();
      return !ectx.actions.ifFrameLoaded(frame);
    }
    function avm1_0x26_ActionTrace(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var value = stack.pop();
      // undefined is always 'undefined' for trace (even for SWF6).
      ectx.actions.trace(value === undefined ? 'undefined' : alToString(ectx.context, value));
    }
    function avm1_0x34_ActionGetTime(ectx: ExecutionContext) {
      var stack = ectx.stack;

      stack.push(ectx.actions.getTimer());
    }
    function avm1_0x30_ActionRandomNumber(ectx: ExecutionContext) {
      var stack = ectx.stack;

      stack.push(ectx.actions.random(stack.pop()));
    }
    // SWF 5
    function avm1_0x3D_ActionCallFunction(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var functionName = stack.pop();
      var args = avm1ReadFunctionArgs(stack);

      var sp = stack.length;
      stack.push(undefined);

      // TODO fix this bind scope lookup, e.g. calling function in with() might require binding
      var resolved = avm1FindGetVariableScope(ectx, functionName);
      if (isNullOrUndefined(resolved)) {
        avm1Warn("AVM1 warning: cannot look up function '" + functionName + "'");
        return;
      }
      var fn = resolved ? resolved.alGet(functionName) : undefined;
      // AVM1 simply ignores attempts to invoke non-functions.
      if (!alIsFunction(fn)) {
        avm1Warn("AVM1 warning: function '" + functionName +
                                          (fn ? "' is not callable" : "' is undefined"));
        return;
      }
      release || assert(stack.length === sp + 1);
      // REDUX
      stack[sp] = fn.alCall(resolved || null, args);
    }
    function avm1_0x52_ActionCallMethod(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var methodName = stack.pop();
      var obj = stack.pop();
      var args = avm1ReadFunctionArgs(stack);
      var target;

      var sp = stack.length;
      stack.push(undefined);

      // AVM1 simply ignores attempts to invoke methods on non-existing objects.
      if (isNullOrUndefined(obj)) {
        avm1Warn("AVM1 warning: method '" + methodName + "' can't be called on undefined object");
        return;
      }

      var frame: AVM1CallFrame = ectx.context.frame;
      var superArg: AVM1Object;
      var fn: AVM1Function;

      // Per spec, a missing or blank method name causes the container to be treated as
      // a function to call.
      if (isNullOrUndefined(methodName) || methodName === '') {
        if (obj instanceof AVM1SuperWrapper) {
          var superFrame = (<AVM1SuperWrapper>obj).callFrame;
          superArg = avm1FindSuperPropertyOwner(ectx.context, superFrame, '__constructor__');
          if (superArg) {
            fn = superArg.alGet('__constructor__');
            target = superFrame.currentThis;
          }
        } else {
          // For non-super calls, we call obj with itself as the target.
          // TODO: ensure this is correct.
          fn = obj;
          target = obj;
        }
        // AVM1 simply ignores attempts to invoke non-functions.
        if (alIsFunction(fn)) {
          frame.setCallee(target, superArg, fn, args);
          stack[sp] = fn.alCall(target, args);
          frame.resetCallee();
        } else {
          avm1Warn("AVM1 warning: obj '" + obj + (obj ? "' is not callable" : "' is undefined"));
        }
        release || assert(stack.length === sp + 1);
        return;
      }

      if (obj instanceof AVM1SuperWrapper) {
        var superFrame = (<AVM1SuperWrapper>obj).callFrame;
        var superArg = avm1FindSuperPropertyOwner(ectx.context, superFrame, methodName);
        if (superArg) {
          fn = superArg.alGet(methodName);
          target = superFrame.currentThis;
        }
     } else {
        fn = as2GetProperty(ectx.context, obj, methodName);
        target = obj;
      }

      // AVM1 simply ignores attempts to invoke non-methods.
      if (!alIsFunction(fn)) {
        avm1Warn("AVM1 warning: method '" + methodName + "' on object", obj,
                                        (isNullOrUndefined(fn) ?
                                                               "is undefined" :
                                                               "is not callable"));
        return;
      }
      release || assert(stack.length === sp + 1);
      frame.setCallee(target, superArg, fn, args);
      stack[sp] = fn.alCall(target, args);
      frame.resetCallee();
    }
    function avm1_0x88_ActionConstantPool(ectx: ExecutionContext, args: any[]) {
      var constantPool: any[] = args[0];
      ectx.constantPool = constantPool;
    }
    function avm1_0x9B_ActionDefineFunction(ectx: ExecutionContext, args: any[]) {
      var stack = ectx.stack;
      var scope = ectx.scope;

      var functionBody = args[0];
      var functionName: string = args[1];
      var functionParams: string[] = args[2];

      var fn = avm1DefineFunction(ectx, functionBody, functionName,
        functionParams, 4, null, 0);
      if (functionName) {
        scope.alPut(functionName, fn);
      } else {
        stack.push(fn);
      }
    }
    function avm1_0x3C_ActionDefineLocal(ectx: ExecutionContext) {
      var stack = ectx.stack;
      var scope = ectx.scope;

      var value = stack.pop();
      var name = stack.pop();
      scope.alPut(name, value);
    }
    function avm1_0x41_ActionDefineLocal2(ectx: ExecutionContext) {
      var stack = ectx.stack;
      var scope = ectx.scope;

      var name = stack.pop();
      scope.alPut(name, undefined);
    }
    function avm1_0x3A_ActionDelete(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var name = stack.pop();
      var obj = stack.pop();
      stack.push(as2DeleteProperty(ectx.context, obj, name));
      as2SyncEvents(ectx.context, name);
    }
    function avm1_0x3B_ActionDelete2(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var name = stack.pop();
      var resolved = avm1FindGetVariableScope(ectx, name);
      if (isNullOrUndefined(resolved)) {
        avm1Warn("AVM1 warning: cannot look up variable '" + name + "'");
        return;
      }
      stack.push(as2DeleteProperty(ectx.context, resolved, name));
      as2SyncEvents(ectx.context, name);
    }
    function avm1_0x46_ActionEnumerate(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var objectName = stack.pop();
      stack.push(null);
      var resolved = avm1FindGetVariableScope(ectx, objectName);
      if (isNullOrUndefined(resolved)) {
        avm1Warn("AVM1 warning: cannot look up variable '" + objectName + "'");
        return;
      }
      var obj = resolved ? resolved.alGet(objectName) : undefined;
      as2Enumerate(obj, function (name) {
        stack.push(name);
      }, null);
    }
    function avm1_0x49_ActionEquals2(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var a = stack.pop();
      var b = stack.pop();
      stack.push(a == b);
    }
    function avm1_0x4E_ActionGetMember(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var name = stack.pop();
      var obj = stack.pop();
      stack.push(undefined);

      if (isNullOrUndefined(obj)) {
        // AVM1 just ignores gets on non-existant containers
        avm1Warn("AVM1 warning: cannot get member '" + name + "' on undefined object");
        return;
      }

      if (obj instanceof AVM1SuperWrapper) {
        var superFrame = (<AVM1SuperWrapper>obj).callFrame;
        var superArg = avm1FindSuperPropertyOwner(ectx.context, superFrame, name);
        if (superArg) {
          stack[stack.length - 1] = superArg.alGet(name);
        }
        return;
      }

      stack[stack.length - 1] = as2GetProperty(ectx.context, obj, name);
    }
    function avm1_0x42_ActionInitArray(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var obj = new Natives.AVM1ArrayNative(ectx.context, avm1ReadFunctionArgs(stack));
      stack.push(obj);
    }
    function avm1_0x43_ActionInitObject(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var count = +stack.pop();
      count = fixArgsCount(count, stack.length >> 1);
      var obj: AVM1Object = alNewObject(ectx.context);
      for (var i = 0; i < count; i++) {
        var value = stack.pop();
        var name = stack.pop();
        obj.alPut(name, value);
      }
      stack.push(obj);
    }
    function avm1_0x53_ActionNewMethod(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var methodName = stack.pop();
      var obj = stack.pop();
      var args = avm1ReadFunctionArgs(stack);

      var sp = stack.length;
      stack.push(undefined);

      // AVM1 simply ignores attempts to construct methods on non-existing objects.
      if (isNullOrUndefined(obj)) {
        avm1Warn("AVM1 warning: method '" + methodName + "' can't be constructed on undefined object");
        return;
      }

      var ctor;

      // Per spec, a missing or blank method name causes the container to be treated as
      // a function to construct.
      if (isNullOrUndefined(methodName) || methodName === '') {
        ctor = obj;
      } else {
        ctor = as2GetProperty(ectx.context, obj, methodName);
      }

      var result = as2Construct(ctor, args);
      if (result === undefined) {
        avm1Warn("AVM1 warning: method '" + methodName + "' on object", obj, "is not constructible");
      }
      stack[sp] = result;
      release || assert(stack.length === sp + 1);
    }
    function avm1_0x40_ActionNewObject(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var objectName = stack.pop();
      var args = avm1ReadFunctionArgs(stack);

      var sp = stack.length;
      stack.push(undefined);

      var resolved = avm1FindGetVariableScope(ectx, objectName);
      if (isNullOrUndefined(resolved)) {
        avm1Warn("AVM1 warning: cannot look up object '" + objectName + "'");
        return;
      }
      var obj = resolved ? resolved.alGet(objectName) : undefined;

      var result = createBuiltinType(ectx.context, obj, args);
      if (result === undefined) {
        // obj in not a built-in type
        result = as2Construct(obj, args);
        if (result === undefined) {
          avm1Warn("AVM1 warning: object '" + objectName +
               (obj ? "' is not constructible" : "' is undefined"));
        }
      }
      release || assert(stack.length === sp + 1);
      stack[sp] = result;
    }
    function avm1_0x4F_ActionSetMember(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var value = stack.pop();
      var name = stack.pop();
      var obj = stack.pop();

      if (isNullOrUndefined(obj)) {
        // AVM1 just ignores sets on non-existant containers
        avm1Warn("AVM1 warning: cannot set member '" + name + "' on undefined object");
        return;
      }

      if (obj instanceof AVM1SuperWrapper) {
        avm1Warn("AVM1 warning: cannot set member '" + name + "' on super");
        return;
      }

      as2SetProperty(ectx.context, obj, name, value);
    }
    function avm1_0x45_ActionTargetPath(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var obj = stack.pop();
      stack.push(isAVM1MovieClip(obj) ? obj._target : void(0));
    }
    function avm1_0x94_ActionWith(ectx: ExecutionContext, args: any[]) {
      var stack = ectx.stack;

      var withBody = args[0];
      var obj = stack.pop();

      avm1ProcessWith(ectx, obj, withBody);
    }
    function avm1_0x4A_ActionToNumber(ectx: ExecutionContext) {
      var stack = ectx.stack;

      stack.push(alToNumber(ectx.context, stack.pop()));
    }
    function avm1_0x4B_ActionToString(ectx: ExecutionContext) {
      var stack = ectx.stack;

      stack.push(alToString(ectx.context, stack.pop()));
    }
    function avm1_0x44_ActionTypeOf(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var obj = stack.pop();
      var result = as2GetType(obj);
      stack.push(result);
    }
    function avm1_0x47_ActionAdd2(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var a = as2ToAddPrimitive(ectx.context, stack.pop());
      var b = as2ToAddPrimitive(ectx.context, stack.pop());
      if (typeof a === 'string' || typeof b === 'string') {
        stack.push(alToString(ectx.context, b) + alToString(ectx.context, a));
      } else {
        stack.push(alToNumber(ectx.context, b) + alToNumber(ectx.context, a));
      }
    }
    function avm1_0x48_ActionLess2(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var a = stack.pop();
      var b = stack.pop();
      stack.push(as2Compare(ectx.context, b, a));
    }
    function avm1_0x3F_ActionModulo(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var a = alToNumber(ectx.context, stack.pop());
      var b = alToNumber(ectx.context, stack.pop());
      stack.push(b % a);
    }
    function avm1_0x60_ActionBitAnd(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var a = alToInt32(ectx.context, stack.pop());
      var b = alToInt32(ectx.context, stack.pop());
      stack.push(b & a);
    }
    function avm1_0x63_ActionBitLShift(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var a = alToInt32(ectx.context, stack.pop());
      var b = alToInt32(ectx.context, stack.pop());
      stack.push(b << a);
    }
    function avm1_0x61_ActionBitOr(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var a = alToInt32(ectx.context, stack.pop());
      var b = alToInt32(ectx.context, stack.pop());
      stack.push(b | a);
    }
    function avm1_0x64_ActionBitRShift(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var a = alToInt32(ectx.context, stack.pop());
      var b = alToInt32(ectx.context, stack.pop());
      stack.push(b >> a);
    }
    function avm1_0x65_ActionBitURShift(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var a = alToInt32(ectx.context, stack.pop());
      var b = alToInt32(ectx.context, stack.pop());
      stack.push(b >>> a);
    }
    function avm1_0x62_ActionBitXor(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var a = alToInt32(ectx.context, stack.pop());
      var b = alToInt32(ectx.context, stack.pop());
      stack.push(b ^ a);
    }
    function avm1_0x51_ActionDecrement(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var a = alToNumber(ectx.context, stack.pop());
      a--;
      stack.push(a);
    }
    function avm1_0x50_ActionIncrement(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var a = alToNumber(ectx.context, stack.pop());
      a++;
      stack.push(a);
    }
    function avm1_0x4C_ActionPushDuplicate(ectx: ExecutionContext) {
      var stack = ectx.stack;

      stack.push(stack[stack.length - 1]);
    }
    function avm1_0x3E_ActionReturn(ectx: ExecutionContext) {
      ectx.isEndOfActions = true;
    }
    function avm1_0x4D_ActionStackSwap(ectx: ExecutionContext) {
      var stack = ectx.stack;

      stack.push(stack.pop(), stack.pop());
    }
    function avm1_0x87_ActionStoreRegister(ectx: ExecutionContext, args: any[]) {
      var stack = ectx.stack;
      var registers = ectx.registers;

      var register: number = args[0];
      if (register < 0 || register >= registers.length) {
        return; // ignoring bad registers references
      }
      registers[register] = stack[stack.length - 1];
    }
    // SWF 6
    function avm1_0x54_ActionInstanceOf(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var constr = stack.pop();
      var obj = stack.pop();
      stack.push(as2InstanceOf(obj, constr));
    }
    function avm1_0x55_ActionEnumerate2(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var obj = stack.pop();
      stack.push(null);

      // AVM1 just ignores lookups on non-existant containers
      if (isNullOrUndefined(obj)) {
        avm1Warn("AVM1 warning: cannot iterate over undefined object");
        return;
      }

      as2Enumerate(obj, function (name) {
        stack.push(name);
      }, null);
    }
    function avm1_0x66_ActionStrictEquals(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var a = stack.pop();
      var b = stack.pop();
      stack.push(b === a);
    }
    function avm1_0x67_ActionGreater(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var a = stack.pop();
      var b = stack.pop();
      stack.push(as2Compare(ectx.context, a, b));
    }
    function avm1_0x68_ActionStringGreater(ectx: ExecutionContext) {
      var stack = ectx.stack;
      var isSwfVersion5 = ectx.isSwfVersion5;

      var sa = alToString(ectx.context, stack.pop());
      var sb = alToString(ectx.context, stack.pop());
      var f = sb > sa;
      stack.push(isSwfVersion5 ? <any>f : f ? 1 : 0);
    }
    // SWF 7
    function avm1_0x8E_ActionDefineFunction2(ectx: ExecutionContext, args: any[]) {
      var stack = ectx.stack;
      var scope = ectx.scope;

      var functionBody = args[0];
      var functionName: string = args[1];
      var functionParams: string[] = args[2];
      var registerCount: number = args[3];
      var registerAllocation = args[4];
      var suppressArguments = args[5];

      var fn = avm1DefineFunction(ectx, functionBody, functionName,
        functionParams, registerCount, registerAllocation, suppressArguments);
      if (functionName) {
        scope.alPut(functionName, fn);
      } else {
        stack.push(fn);
      }
    }
    function avm1_0x69_ActionExtends(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var constrSuper = stack.pop();
      var constr = stack.pop();
      var prototype = constr.alGetPrototypeProperty();
      var prototypeSuper = constrSuper.alGetPrototypeProperty();
      prototype.alPrototype = prototypeSuper;
      prototype.alSetOwnProperty('__constructor__', {
        flags: AVM1PropertyFlags.DATA | AVM1PropertyFlags.DONT_ENUM,
        value: constrSuper
      });
    }
    function avm1_0x2B_ActionCastOp(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var obj =  stack.pop();
      var constr = stack.pop();
      stack.push(as2InstanceOf(obj, constr) ? obj : null);
    }
    function avm1_0x2C_ActionImplementsOp(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var constr = stack.pop();
      var count = +stack.pop();
      fixArgsCount(count, stack.length);
      var interfaces = [];
      for (var i = 0; i < count; i++) {
        interfaces.push(stack.pop());
      }
      constr._as2Interfaces = interfaces;
    }
    function avm1_0x8F_ActionTry(ectx: ExecutionContext, args: any[]) {
      var catchIsRegisterFlag: boolean = args[0];
      var catchTarget = args[1];
      var tryBody = args[2];
      var catchBlockFlag: boolean = args[3];
      var catchBody = args[4];
      var finallyBlockFlag: boolean = args[5];
      var finallyBody = args[6];

      avm1ProcessTry(ectx, catchIsRegisterFlag,
        finallyBlockFlag, catchBlockFlag, catchTarget,
        tryBody, catchBody, finallyBody);
    }
    function avm1_0x2A_ActionThrow(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var obj = stack.pop();
      throw new AVM1Error(obj);
    }
    function avm1_0x2D_ActionFSCommand2(ectx: ExecutionContext) {
      var stack = ectx.stack;

      var args = avm1ReadFunctionArgs(stack);

      var sp = stack.length;
      stack.push(undefined);

      var result = ectx.actions.fscommand.apply(ectx.actions, args);
      stack[sp] = result;
    }
    function avm1_0x89_ActionStrictMode(ectx: ExecutionContext, args: any[]) {
      var mode: number = args[0];
    }

    function wrapAvm1Error(fn: Function): Function {
      return function avm1ErrorWrapper(executionContext: ExecutionContext, args: any[]) {
        var currentContext: AVM1ContextImpl;
        try {
          fn(executionContext, args);

          executionContext.recoveringFromError = false;
        } catch (e) {
          // handling AVM1 errors
          currentContext = executionContext.context;
          e = as2CastError(e);
          if (e instanceof AVM1CriticalError) {
            throw e;
          }
          if (e instanceof AVM1Error) {
            throw e;
          }

          Telemetry.instance.reportTelemetry({topic: 'error', error: Telemetry.ErrorTypes.AVM1_ERROR});

          if (!executionContext.recoveringFromError) {
            if (currentContext.errorsIgnored++ >= MAX_AVM1_ERRORS_LIMIT) {
              throw new AVM1CriticalError('long running script -- AVM1 errors limit is reached');
            }
            console.log(typeof e);
            console.log(Object.getPrototypeOf(e));
            console.log(Object.getPrototypeOf(Object.getPrototypeOf(e)));
            console.error('AVM1 error: ' + e);
            var avm2 = null; // REDUX: Shumway.AVM2.Runtime.AVM2;
            avm2.instance.exceptions.push({source: 'avm1', message: e.message,
              stack: e.stack});
            executionContext.recoveringFromError = true;
          }
        }
      };
    }

    function generateActionCalls() {
      var wrap: Function;
      if (!avm1ErrorsEnabled.value) {
        wrap = wrapAvm1Error;
      } else {
        wrap = function (fn: Function) { return fn; };
      }
      return {
        ActionGotoFrame: wrap(avm1_0x81_ActionGotoFrame),
        ActionGetURL: wrap(avm1_0x83_ActionGetURL),
        ActionNextFrame: wrap(avm1_0x04_ActionNextFrame),
        ActionPreviousFrame: wrap(avm1_0x05_ActionPreviousFrame),
        ActionPlay: wrap(avm1_0x06_ActionPlay),
        ActionStop: wrap(avm1_0x07_ActionStop),
        ActionToggleQuality: wrap(avm1_0x08_ActionToggleQuality),
        ActionStopSounds: wrap(avm1_0x09_ActionStopSounds),
        ActionWaitForFrame: wrap(avm1_0x8A_ActionWaitForFrame),
        ActionSetTarget: wrap(avm1_0x8B_ActionSetTarget),
        ActionGoToLabel: wrap(avm1_0x8C_ActionGoToLabel),
        ActionPush: wrap(avm1_0x96_ActionPush),
        ActionPop: wrap(avm1_0x17_ActionPop),
        ActionAdd: wrap(avm1_0x0A_ActionAdd),
        ActionSubtract: wrap(avm1_0x0B_ActionSubtract),
        ActionMultiply: wrap(avm1_0x0C_ActionMultiply),
        ActionDivide: wrap(avm1_0x0D_ActionDivide),
        ActionEquals: wrap(avm1_0x0E_ActionEquals),
        ActionLess: wrap(avm1_0x0F_ActionLess),
        ActionAnd: wrap(avm1_0x10_ActionAnd),
        ActionOr: wrap(avm1_0x11_ActionOr),
        ActionNot: wrap(avm1_0x12_ActionNot),
        ActionStringEquals: wrap(avm1_0x13_ActionStringEquals),
        ActionStringLength: wrap(avm1_0x14_ActionStringLength),
        ActionMBStringLength: wrap(avm1_0x31_ActionMBStringLength),
        ActionStringAdd: wrap(avm1_0x21_ActionStringAdd),
        ActionStringExtract: wrap(avm1_0x15_ActionStringExtract),
        ActionMBStringExtract: wrap(avm1_0x35_ActionMBStringExtract),
        ActionStringLess: wrap(avm1_0x29_ActionStringLess),
        ActionToInteger: wrap(avm1_0x18_ActionToInteger),
        ActionCharToAscii: wrap(avm1_0x32_ActionCharToAscii),
        ActionMBCharToAscii: wrap(avm1_0x36_ActionMBCharToAscii),
        ActionAsciiToChar: wrap(avm1_0x33_ActionAsciiToChar),
        ActionMBAsciiToChar: wrap(avm1_0x37_ActionMBAsciiToChar),
        ActionJump: wrap(avm1_0x99_ActionJump),
        ActionIf: wrap(avm1_0x9D_ActionIf),
        ActionCall: wrap(avm1_0x9E_ActionCall),
        ActionGetVariable: wrap(avm1_0x1C_ActionGetVariable),
        ActionSetVariable: wrap(avm1_0x1D_ActionSetVariable),
        ActionGetURL2: wrap(avm1_0x9A_ActionGetURL2),
        ActionGotoFrame2: wrap(avm1_0x9F_ActionGotoFrame2),
        ActionSetTarget2: wrap(avm1_0x20_ActionSetTarget2),
        ActionGetProperty: wrap(avm1_0x22_ActionGetProperty),
        ActionSetProperty: wrap(avm1_0x23_ActionSetProperty),
        ActionCloneSprite: wrap(avm1_0x24_ActionCloneSprite),
        ActionRemoveSprite: wrap(avm1_0x25_ActionRemoveSprite),
        ActionStartDrag: wrap(avm1_0x27_ActionStartDrag),
        ActionEndDrag: wrap(avm1_0x28_ActionEndDrag),
        ActionWaitForFrame2: wrap(avm1_0x8D_ActionWaitForFrame2),
        ActionTrace: wrap(avm1_0x26_ActionTrace),
        ActionGetTime: wrap(avm1_0x34_ActionGetTime),
        ActionRandomNumber: wrap(avm1_0x30_ActionRandomNumber),
        ActionCallFunction: wrap(avm1_0x3D_ActionCallFunction),
        ActionCallMethod: wrap(avm1_0x52_ActionCallMethod),
        ActionConstantPool: wrap(avm1_0x88_ActionConstantPool),
        ActionDefineFunction: wrap(avm1_0x9B_ActionDefineFunction),
        ActionDefineLocal: wrap(avm1_0x3C_ActionDefineLocal),
        ActionDefineLocal2: wrap(avm1_0x41_ActionDefineLocal2),
        ActionDelete: wrap(avm1_0x3A_ActionDelete),
        ActionDelete2: wrap(avm1_0x3B_ActionDelete2),
        ActionEnumerate: wrap(avm1_0x46_ActionEnumerate),
        ActionEquals2: wrap(avm1_0x49_ActionEquals2),
        ActionGetMember: wrap(avm1_0x4E_ActionGetMember),
        ActionInitArray: wrap(avm1_0x42_ActionInitArray),
        ActionInitObject: wrap(avm1_0x43_ActionInitObject),
        ActionNewMethod: wrap(avm1_0x53_ActionNewMethod),
        ActionNewObject: wrap(avm1_0x40_ActionNewObject),
        ActionSetMember: wrap(avm1_0x4F_ActionSetMember),
        ActionTargetPath: wrap(avm1_0x45_ActionTargetPath),
        ActionWith: wrap(avm1_0x94_ActionWith),
        ActionToNumber: wrap(avm1_0x4A_ActionToNumber),
        ActionToString: wrap(avm1_0x4B_ActionToString),
        ActionTypeOf: wrap(avm1_0x44_ActionTypeOf),
        ActionAdd2: wrap(avm1_0x47_ActionAdd2),
        ActionLess2: wrap(avm1_0x48_ActionLess2),
        ActionModulo: wrap(avm1_0x3F_ActionModulo),
        ActionBitAnd: wrap(avm1_0x60_ActionBitAnd),
        ActionBitLShift: wrap(avm1_0x63_ActionBitLShift),
        ActionBitOr: wrap(avm1_0x61_ActionBitOr),
        ActionBitRShift: wrap(avm1_0x64_ActionBitRShift),
        ActionBitURShift: wrap(avm1_0x65_ActionBitURShift),
        ActionBitXor: wrap(avm1_0x62_ActionBitXor),
        ActionDecrement: wrap(avm1_0x51_ActionDecrement),
        ActionIncrement: wrap(avm1_0x50_ActionIncrement),
        ActionPushDuplicate: wrap(avm1_0x4C_ActionPushDuplicate),
        ActionReturn: wrap(avm1_0x3E_ActionReturn),
        ActionStackSwap: wrap(avm1_0x4D_ActionStackSwap),
        ActionStoreRegister: wrap(avm1_0x87_ActionStoreRegister),
        ActionInstanceOf: wrap(avm1_0x54_ActionInstanceOf),
        ActionEnumerate2: wrap(avm1_0x55_ActionEnumerate2),
        ActionStrictEquals: wrap(avm1_0x66_ActionStrictEquals),
        ActionGreater: wrap(avm1_0x67_ActionGreater),
        ActionStringGreater: wrap(avm1_0x68_ActionStringGreater),
        ActionDefineFunction2: wrap(avm1_0x8E_ActionDefineFunction2),
        ActionExtends: wrap(avm1_0x69_ActionExtends),
        ActionCastOp: wrap(avm1_0x2B_ActionCastOp),
        ActionImplementsOp: wrap(avm1_0x2C_ActionImplementsOp),
        ActionTry: wrap(avm1_0x8F_ActionTry),
        ActionThrow: wrap(avm1_0x2A_ActionThrow),
        ActionFSCommand2: wrap(avm1_0x2D_ActionFSCommand2),
        ActionStrictMode: wrap(avm1_0x89_ActionStrictMode)
      };
    }

    function interpretAction(executionContext: ExecutionContext, parsedAction: ParsedAction): boolean {
      var stack = executionContext.stack;

      var actionCode: number = parsedAction.actionCode;
      var args: any[] = parsedAction.args;

      var actionTracer = executionContext.actionTracer;
      actionTracer.print(parsedAction, stack);

      var shallBranch = false;
      switch (actionCode | 0) {
        // SWF 3 actions
        case ActionCode.ActionGotoFrame:
          avm1_0x81_ActionGotoFrame(executionContext, args);
          break;
        case ActionCode.ActionGetURL:
          avm1_0x83_ActionGetURL(executionContext, args);
          break;
        case ActionCode.ActionNextFrame:
          avm1_0x04_ActionNextFrame(executionContext);
          break;
        case ActionCode.ActionPreviousFrame:
          avm1_0x05_ActionPreviousFrame(executionContext);
          break;
        case ActionCode.ActionPlay:
          avm1_0x06_ActionPlay(executionContext);
          break;
        case ActionCode.ActionStop:
          avm1_0x07_ActionStop(executionContext);
          break;
        case ActionCode.ActionToggleQuality:
          avm1_0x08_ActionToggleQuality(executionContext);
          break;
        case ActionCode.ActionStopSounds:
          avm1_0x09_ActionStopSounds(executionContext);
          break;
        case ActionCode.ActionWaitForFrame:
          shallBranch = avm1_0x8A_ActionWaitForFrame(executionContext, args);
          break;
        case ActionCode.ActionSetTarget:
          avm1_0x8B_ActionSetTarget(executionContext, args);
          break;
        case ActionCode.ActionGoToLabel:
          avm1_0x8C_ActionGoToLabel(executionContext, args);
          break;
        // SWF 4 actions
        case ActionCode.ActionPush:
          avm1_0x96_ActionPush(executionContext, args);
          break;
        case ActionCode.ActionPop:
          avm1_0x17_ActionPop(executionContext);
          break;
        case ActionCode.ActionAdd:
          avm1_0x0A_ActionAdd(executionContext);
          break;
        case ActionCode.ActionSubtract:
          avm1_0x0B_ActionSubtract(executionContext);
          break;
        case ActionCode.ActionMultiply:
          avm1_0x0C_ActionMultiply(executionContext);
          break;
        case ActionCode.ActionDivide:
          avm1_0x0D_ActionDivide(executionContext);
          break;
        case ActionCode.ActionEquals:
          avm1_0x0E_ActionEquals(executionContext);
          break;
        case ActionCode.ActionLess:
          avm1_0x0F_ActionLess(executionContext);
          break;
        case ActionCode.ActionAnd:
          avm1_0x10_ActionAnd(executionContext);
          break;
        case ActionCode.ActionOr:
          avm1_0x11_ActionOr(executionContext);
          break;
        case ActionCode.ActionNot:
          avm1_0x12_ActionNot(executionContext);
          break;
        case ActionCode.ActionStringEquals:
          avm1_0x13_ActionStringEquals(executionContext);
          break;
        case ActionCode.ActionStringLength:
          avm1_0x14_ActionStringLength(executionContext);
          break;
        case ActionCode.ActionMBStringLength:
          avm1_0x31_ActionMBStringLength(executionContext);
          break;
        case ActionCode.ActionStringAdd:
          avm1_0x21_ActionStringAdd(executionContext);
          break;
        case ActionCode.ActionStringExtract:
          avm1_0x15_ActionStringExtract(executionContext);
          break;
        case ActionCode.ActionMBStringExtract:
          avm1_0x35_ActionMBStringExtract(executionContext);
          break;
        case ActionCode.ActionStringLess:
          avm1_0x29_ActionStringLess(executionContext);
          break;
        case ActionCode.ActionToInteger:
          avm1_0x18_ActionToInteger(executionContext);
          break;
        case ActionCode.ActionCharToAscii:
          avm1_0x32_ActionCharToAscii(executionContext);
          break;
        case ActionCode.ActionMBCharToAscii:
          avm1_0x36_ActionMBCharToAscii(executionContext);
          break;
        case ActionCode.ActionAsciiToChar:
          avm1_0x33_ActionAsciiToChar(executionContext);
          break;
        case ActionCode.ActionMBAsciiToChar:
          avm1_0x37_ActionMBAsciiToChar(executionContext);
          break;
        case ActionCode.ActionJump:
          avm1_0x99_ActionJump(executionContext, args);
          break;
        case ActionCode.ActionIf:
          shallBranch = avm1_0x9D_ActionIf(executionContext, args);
          break;
        case ActionCode.ActionCall:
          avm1_0x9E_ActionCall(executionContext);
          break;
        case ActionCode.ActionGetVariable:
          avm1_0x1C_ActionGetVariable(executionContext);
          break;
        case ActionCode.ActionSetVariable:
          avm1_0x1D_ActionSetVariable(executionContext);
          break;
        case ActionCode.ActionGetURL2:
          avm1_0x9A_ActionGetURL2(executionContext, args);
          break;
        case ActionCode.ActionGotoFrame2:
          avm1_0x9F_ActionGotoFrame2(executionContext, args);
          break;
        case ActionCode.ActionSetTarget2:
          avm1_0x20_ActionSetTarget2(executionContext);
          break;
        case ActionCode.ActionGetProperty:
          avm1_0x22_ActionGetProperty(executionContext);
          break;
        case ActionCode.ActionSetProperty:
          avm1_0x23_ActionSetProperty(executionContext);
          break;
        case ActionCode.ActionCloneSprite:
          avm1_0x24_ActionCloneSprite(executionContext);
          break;
        case ActionCode.ActionRemoveSprite:
          avm1_0x25_ActionRemoveSprite(executionContext);
          break;
        case ActionCode.ActionStartDrag:
          avm1_0x27_ActionStartDrag(executionContext);
          break;
        case ActionCode.ActionEndDrag:
          avm1_0x28_ActionEndDrag(executionContext);
          break;
        case ActionCode.ActionWaitForFrame2:
          shallBranch = avm1_0x8D_ActionWaitForFrame2(executionContext, args);
          break;
        case ActionCode.ActionTrace:
          avm1_0x26_ActionTrace(executionContext);
          break;
        case ActionCode.ActionGetTime:
          avm1_0x34_ActionGetTime(executionContext);
          break;
        case ActionCode.ActionRandomNumber:
          avm1_0x30_ActionRandomNumber(executionContext);
          break;
        // SWF 5
        case ActionCode.ActionCallFunction:
          avm1_0x3D_ActionCallFunction(executionContext);
          break;
        case ActionCode.ActionCallMethod:
          avm1_0x52_ActionCallMethod(executionContext);
          break;
        case ActionCode.ActionConstantPool:
          avm1_0x88_ActionConstantPool(executionContext, args);
          break;
        case ActionCode.ActionDefineFunction:
          avm1_0x9B_ActionDefineFunction(executionContext, args);
          break;
        case ActionCode.ActionDefineLocal:
          avm1_0x3C_ActionDefineLocal(executionContext);
          break;
        case ActionCode.ActionDefineLocal2:
          avm1_0x41_ActionDefineLocal2(executionContext);
          break;
        case ActionCode.ActionDelete:
          avm1_0x3A_ActionDelete(executionContext);
          break;
        case ActionCode.ActionDelete2:
          avm1_0x3B_ActionDelete2(executionContext);
          break;
        case ActionCode.ActionEnumerate:
          avm1_0x46_ActionEnumerate(executionContext);
          break;
        case ActionCode.ActionEquals2:
          avm1_0x49_ActionEquals2(executionContext);
          break;
        case ActionCode.ActionGetMember:
          avm1_0x4E_ActionGetMember(executionContext);
          break;
        case ActionCode.ActionInitArray:
          avm1_0x42_ActionInitArray(executionContext);
          break;
        case ActionCode.ActionInitObject:
          avm1_0x43_ActionInitObject(executionContext);
          break;
        case ActionCode.ActionNewMethod:
          avm1_0x53_ActionNewMethod(executionContext);
          break;
        case ActionCode.ActionNewObject:
          avm1_0x40_ActionNewObject(executionContext);
          break;
        case ActionCode.ActionSetMember:
          avm1_0x4F_ActionSetMember(executionContext);
          break;
        case ActionCode.ActionTargetPath:
          avm1_0x45_ActionTargetPath(executionContext);
          break;
        case ActionCode.ActionWith:
          avm1_0x94_ActionWith(executionContext, args);
          break;
        case ActionCode.ActionToNumber:
          avm1_0x4A_ActionToNumber(executionContext);
          break;
        case ActionCode.ActionToString:
          avm1_0x4B_ActionToString(executionContext);
          break;
        case ActionCode.ActionTypeOf:
          avm1_0x44_ActionTypeOf(executionContext);
          break;
        case ActionCode.ActionAdd2:
          avm1_0x47_ActionAdd2(executionContext);
          break;
        case ActionCode.ActionLess2:
          avm1_0x48_ActionLess2(executionContext);
          break;
        case ActionCode.ActionModulo:
          avm1_0x3F_ActionModulo(executionContext);
          break;
        case ActionCode.ActionBitAnd:
          avm1_0x60_ActionBitAnd(executionContext);
          break;
        case ActionCode.ActionBitLShift:
          avm1_0x63_ActionBitLShift(executionContext);
          break;
        case ActionCode.ActionBitOr:
          avm1_0x61_ActionBitOr(executionContext);
          break;
        case ActionCode.ActionBitRShift:
          avm1_0x64_ActionBitRShift(executionContext);
          break;
        case ActionCode.ActionBitURShift:
          avm1_0x65_ActionBitURShift(executionContext);
          break;
        case ActionCode.ActionBitXor:
          avm1_0x62_ActionBitXor(executionContext);
          break;
        case ActionCode.ActionDecrement:
          avm1_0x51_ActionDecrement(executionContext);
          break;
        case ActionCode.ActionIncrement:
          avm1_0x50_ActionIncrement(executionContext);
          break;
        case ActionCode.ActionPushDuplicate:
          avm1_0x4C_ActionPushDuplicate(executionContext);
          break;
        case ActionCode.ActionReturn:
          avm1_0x3E_ActionReturn(executionContext);
          break;
        case ActionCode.ActionStackSwap:
          avm1_0x4D_ActionStackSwap(executionContext);
          break;
        case ActionCode.ActionStoreRegister:
          avm1_0x87_ActionStoreRegister(executionContext, args);
          break;
        // SWF 6
        case ActionCode.ActionInstanceOf:
          avm1_0x54_ActionInstanceOf(executionContext);
          break;
        case ActionCode.ActionEnumerate2:
          avm1_0x55_ActionEnumerate2(executionContext);
          break;
        case ActionCode.ActionStrictEquals:
          avm1_0x66_ActionStrictEquals(executionContext);
          break;
        case ActionCode.ActionGreater:
          avm1_0x67_ActionGreater(executionContext);
          break;
        case ActionCode.ActionStringGreater:
          avm1_0x68_ActionStringGreater(executionContext);
          break;
        // SWF 7
        case ActionCode.ActionDefineFunction2:
          avm1_0x8E_ActionDefineFunction2(executionContext, args);
          break;
        case ActionCode.ActionExtends:
          avm1_0x69_ActionExtends(executionContext);
          break;
        case ActionCode.ActionCastOp:
          avm1_0x2B_ActionCastOp(executionContext);
          break;
        case ActionCode.ActionImplementsOp:
          avm1_0x2C_ActionImplementsOp(executionContext);
          break;
        case ActionCode.ActionTry:
          avm1_0x8F_ActionTry(executionContext, args);
          break;
        case ActionCode.ActionThrow:
          avm1_0x2A_ActionThrow(executionContext);
          break;
        // Not documented by the spec
        case ActionCode.ActionFSCommand2:
          avm1_0x2D_ActionFSCommand2(executionContext);
          break;
        case ActionCode.ActionStrictMode:
          avm1_0x89_ActionStrictMode(executionContext, args);
          break;
        case ActionCode.None: // End of actions
          executionContext.isEndOfActions = true;
          break;
        default:
          throw new Error('Unknown action code: ' + actionCode);
      }
      return shallBranch;
    }

    function interpretActionWithRecovery(executionContext: ExecutionContext,
                                         parsedAction: ParsedAction): boolean {
      var currentContext: AVM1ContextImpl;
      var result;
      try {
        result = interpretAction(executionContext, parsedAction);

        executionContext.recoveringFromError = false;

      } catch (e) {
        // handling AVM1 errors
        currentContext = executionContext.context;
        e = as2CastError(e);
        if ((avm1ErrorsEnabled.value && !currentContext.isTryCatchListening) ||
          e instanceof AVM1CriticalError) {
          throw e;
        }
        if (e instanceof AVM1Error) {
          throw e;
        }

        Telemetry.instance.reportTelemetry({topic: 'error', error: Telemetry.ErrorTypes.AVM1_ERROR});

        if (!executionContext.recoveringFromError) {
          if (currentContext.errorsIgnored++ >= MAX_AVM1_ERRORS_LIMIT) {
            throw new AVM1CriticalError('long running script -- AVM1 errors limit is reached');
          }
          console.error('AVM1 error: ' + e);
          var avm2 = null; // REDUX: Shumway.AVM2.Runtime.AVM2;
          avm2.instance.exceptions.push({source: 'avm1', message: e.message,
            stack: e.stack});
          executionContext.recoveringFromError = true;
        }
      }
      return result;
    }

    function interpretActionsData(currentContext: AVM1ContextImpl, actionsData: AVM1ActionsData, scopeContainer, constantPool, registers) {
      if (!actionsData.ir) {
        var parser = new ActionsDataParser(actionsData, currentContext.swfVersion);
        var analyzer = new ActionsDataAnalyzer();
        analyzer.registersLimit = registers.length;
        analyzer.parentResults = actionsData.parent && actionsData.parent.ir;
        actionsData.ir = analyzer.analyze(parser);

        if (avm1CompilerEnabled.value) {
          try {
            var c = new ActionsDataCompiler();
            (<any> actionsData.ir).compiled = c.generate(actionsData.ir);
          } catch (e) {
            console.error('Unable to compile AVM1 function: ' + e);
          }
        }
      }
      var ir: AnalyzerResults = actionsData.ir;
      var compiled: Function = (<any> ir).compiled;

      var stack = [];
      var isSwfVersion5 = currentContext.swfVersion >= 5;
      var actionTracer = ActionTracerFactory.get();
      var scope = scopeContainer.scope;

      var executionContext = {
        context: currentContext,
        actions: currentContext.actions,
        scopeContainer: scopeContainer,
        scope: scope,
        actionTracer: actionTracer,
        constantPool: constantPool,
        registers: registers,
        stack: stack,
        frame: null,
        isSwfVersion5: isSwfVersion5,
        recoveringFromError: false,
        isEndOfActions: false
      };

      if (scope._as3Object &&
          scope._as3Object._deferScriptExecution) {
        currentContext.deferScriptExecution = true;
      }

      if (compiled) {
        return compiled(executionContext);
      }

      var instructionsExecuted = 0;
      var abortExecutionAt = currentContext.abortExecutionAt;

      if (avm1DebuggerEnabled.value &&
          (Debugger.pause || Debugger.breakpoints[ir.dataId])) {
        debugger;
      }

      var position = 0;
      var nextAction: ActionCodeBlockItem = ir.actions[position];
      // will try again if we are skipping errors
      while (nextAction && !executionContext.isEndOfActions) {
        // let's check timeout/Date.now every some number of instructions
        if (instructionsExecuted++ % CHECK_AVM1_HANG_EVERY === 0 && Date.now() >= abortExecutionAt) {
          throw new AVM1CriticalError('long running script -- AVM1 instruction hang timeout');
        }

        var shallBranch: boolean = interpretActionWithRecovery(executionContext, nextAction.action);
        if (shallBranch) {
          position = nextAction.conditionalJumpTo;
        } else {
          position = nextAction.next;
        }
        nextAction = ir.actions[position];
      }
      return stack.pop();
    }

  // Bare-minimum JavaScript code generator to make debugging better.
  class ActionsDataCompiler {
    static cachedCalls;
    constructor() {
      if (!ActionsDataCompiler.cachedCalls) {
        ActionsDataCompiler.cachedCalls = generateActionCalls();
      }
    }
    private convertArgs(args: any[], id: number, res, ir: AnalyzerResults): string {
      var parts: string[] = [];
      for (var i: number = 0; i < args.length; i++) {
        var arg = args[i];
        if (typeof arg === 'object' && arg !== null && !Array.isArray(arg)) {
          if (arg instanceof ParsedPushConstantAction) {
            if (ir.singleConstantPool) {
              var constant = ir.singleConstantPool[(<ParsedPushConstantAction> arg).constantIndex];
              parts.push(constant === undefined ? 'undefined' : JSON.stringify(constant));
            } else {
              var hint = '';
              var currentConstantPool = res.constantPool;
              if (currentConstantPool) {
                var constant = currentConstantPool[(<ParsedPushConstantAction> arg).constantIndex];
                hint = constant === undefined ? 'undefined' : JSON.stringify(constant);
                // preventing code breakage due to bad constant
                hint = hint.indexOf('*/') >= 0 ? '' : ' /* ' + hint + ' */';
              }
              parts.push('constantPool[' + (<ParsedPushConstantAction> arg).constantIndex + ']' + hint);
            }
          } else if (arg instanceof ParsedPushRegisterAction) {
            var registerNumber = (<ParsedPushRegisterAction> arg).registerNumber;
            if (registerNumber < 0 || registerNumber >= ir.registersLimit) {
              parts.push('undefined'); // register is out of bounds -- undefined
            } else {
              parts.push('registers[' + registerNumber + ']');
            }
          } else if (arg instanceof AVM1ActionsData) {
            var resName = 'code_' + id + '_' + i;
            res[resName] = arg;
            parts.push('res.' + resName);
          } else {
            notImplemented('Unknown AVM1 action argument type');
          }
        } else if (arg === undefined) {
          parts.push('undefined'); // special case
        } else {
          parts.push(JSON.stringify(arg));
        }
      }
      return parts.join(',');
    }
    private convertAction(item: ActionCodeBlockItem, id: number, res, indexInBlock: number, ir: AnalyzerResults): string {
      switch (item.action.actionCode) {
        case ActionCode.ActionJump:
        case ActionCode.ActionReturn:
          return '';
        case ActionCode.ActionConstantPool:
          res.constantPool = item.action.args[0];
          return '  constantPool = [' + this.convertArgs(item.action.args[0], id, res, ir) + '];\n' +
                 '  ectx.constantPool = constantPool;\n';
        case ActionCode.ActionPush:
          return '  stack.push(' + this.convertArgs(item.action.args, id, res, ir) + ');\n';
        case ActionCode.ActionStoreRegister:
          var registerNumber = item.action.args[0];
          if (registerNumber < 0 || registerNumber >= ir.registersLimit) {
            return ''; // register is out of bounds -- noop
          }
          return '  registers[' + registerNumber + '] = stack[stack.length - 1];\n';
        case ActionCode.ActionWaitForFrame:
        case ActionCode.ActionWaitForFrame2:
          return '  if (calls.' + item.action.actionName + '(ectx,[' +
            this.convertArgs(item.action.args, id, res, ir) + '])) { position = ' + item.conditionalJumpTo + '; ' +
            'checkTimeAfter -= ' + (indexInBlock + 1) + '; break; }\n';
        case ActionCode.ActionIf:
          return '  if (!!stack.pop()) { position = ' + item.conditionalJumpTo + '; ' +
            'checkTimeAfter -= ' + (indexInBlock + 1) + '; break; }\n';
        default:
          var result = '  calls.' + item.action.actionName + '(ectx' +
            (item.action.args ? ',[' + this.convertArgs(item.action.args, id, res, ir) + ']' : '') +
            ');\n';
          return result;
      }
    }
    private checkAvm1Timeout(ectx: ExecutionContext) {
      if (Date.now() >= ectx.context.abortExecutionAt) {
        throw new AVM1CriticalError('long running script -- AVM1 instruction hang timeout');
      }
    }
    generate(ir: AnalyzerResults): Function {
      var blocks = ir.blocks;
      var res = {};
      var uniqueId = 0;
      var debugName = ir.dataId;
      var fn = 'return function avm1gen_' + debugName + '(ectx) {\n' +
        'var position = 0;\n' +
        'var checkTimeAfter = 0;\n' +
        'var constantPool = ectx.constantPool, registers = ectx.registers, stack = ectx.stack;\n';
      if (avm1DebuggerEnabled.value) {
        fn += '/* Running ' + debugName + ' */ ' +
          'if (Shumway.AVM1.Debugger.pause || Shumway.AVM1.Debugger.breakpoints.' +
          debugName + ') { debugger; }\n'
      }
      fn += 'while (!ectx.isEndOfActions) {\n' +
        'if (checkTimeAfter <= 0) { checkTimeAfter = ' + CHECK_AVM1_HANG_EVERY + '; checkTimeout(ectx); }\n' +
        'switch(position) {\n';
        blocks.forEach((b: ActionCodeBlock) => {
          fn += ' case ' + b.label + ':\n';
          b.items.forEach((item: ActionCodeBlockItem, index: number) => {
            fn += this.convertAction(item, uniqueId++, res, index, ir);
          });
          fn += '  position = ' + b.jump + ';\n' +
                '  checkTimeAfter -= ' + b.items.length + ';\n' +
                '  break;\n'
        });
      fn += ' default: ectx.isEndOfActions = true; break;\n}\n}\n' +
        'return stack.pop();};';
      fn += '//# sourceURL=avm1gen-' + debugName;
      return (new Function('calls', 'res', 'checkTimeout', fn))(
        ActionsDataCompiler.cachedCalls, res, this.checkAvm1Timeout);
    }
  }

  interface ActionTracer {
    print: (parsedAction: ParsedAction, stack: any[]) => void;
    indent: () => void;
    unindent: () => void;
    message: (msg: string) => void;
  }

  class ActionTracerFactory {
    private static tracer : ActionTracer = (
      () => {
        var indentation = 0;
        return {
          print: function(parsedAction: ParsedAction, stack: any[]) {
            var position: number = parsedAction.position;
            var actionCode: number = parsedAction.actionCode;
            var actionName: string = parsedAction.actionName;
            var stackDump = [];
            for(var q = 0; q < stack.length; q++) {
              var item = stack[q];
              if (item && typeof item === 'object') {
                var constr = item.alGetConstructorProperty();
                stackDump.push('[' + (constr ? constr.name : 'Object') + ']');

              } else {
                stackDump.push(item);
              }
            }

            var indent = new Array(indentation + 1).join('..');

            console.log('AVM1 trace: ' + indent + position + ': ' +
              actionName + '(' + actionCode.toString(16) + '), ' +
              'stack=' + stackDump);
          },
          indent: function() {
            indentation++;
          },
          unindent: function() {
            indentation--;
          },
          message: function(msg: string) {
            console.log('AVM1 trace: ------- ' + msg);
          }
        };
      }
    )();

    private static nullTracer : ActionTracer = {
      print: function(parsedAction: ParsedAction, stack: any[]) {},
      indent: function() {},
      unindent: function() {},
      message: function(msg: string) {}
    };

    static get(): ActionTracer {
      return avm1TraceEnabled.value ?
        ActionTracerFactory.tracer :
        ActionTracerFactory.nullTracer;
    }
  }

}
