/**
 * MetaobjectProtocol interface.
 */
interface IMetaobjectProtocol {
  axResolveMultiname(mn: Shumway.AVMX.Multiname): any;
  axHasProperty(mn: Shumway.AVMX.Multiname): boolean;
  axDeleteProperty(mn: Shumway.AVMX.Multiname): boolean;

  axCallProperty(mn: Shumway.AVMX.Multiname, argArray: any [], isLex: boolean): any;
  axCallSuper(mn: Shumway.AVMX.Multiname, scope: Shumway.AVMX.Scope, argArray: any []): any;
  axConstructProperty(mn: Shumway.AVMX.Multiname, args: any []): any;
  axHasPropertyInternal(mn: Shumway.AVMX.Multiname): boolean;
  axHasOwnProperty(mn: Shumway.AVMX.Multiname): boolean;

  axSetProperty(mn: Shumway.AVMX.Multiname, value: any);
  axGetProperty(mn: Shumway.AVMX.Multiname): any;
  axGetSuper(mn: Shumway.AVMX.Multiname, scope: Shumway.AVMX.Scope): any;
  axSetSuper(mn: Shumway.AVMX.Multiname, scope: Shumway.AVMX.Scope, value: any);

  axNextNameIndex(index: number): any;
  axNextName(index: number): any;
  axNextValue(index: number): any;

  axEnumerableKeys: any [];
  axGetEnumerableKeys(): any [];

  axHasPublicProperty(nm: any): boolean;
  axSetPublicProperty(nm: any, value: any);
  axGetPublicProperty(nm: any): any;
  axCallPublicProperty(nm: any, argArray: any []): any;

  axSetNumericProperty(nm: number, value: any);
  axGetNumericProperty(nm: number): any;

  axDefinePublicProperty(nm: any, description: any): any;

  axGetSlot(i: number): any;
  axSetSlot(i: number, value: any);

  getPrototypeOf(): any;
}

interface Function {
  axApply(thisArg: any, argArray?: any[]): any;
  axCall(thisArg: any): any;
}

var $: Shumway.AVMX.SecurityDomain = null;

module Shumway.AVMX {
  /*
   *     +--------------------------+
   *     |      Base Prototype      |
   *     +--------------------------+
   *     |- axHasPropertyInternal   |
   *     |- axHasProperty           |            +-------------------+
   *     |- axSetProperty           |     +-----#|  objectPrototype  |
   *     |- axGetProperty           |     |      +-------------------+
   *     |- axSetPublicProperty     |     |      | - securityDomain  |
   *     |- axGetSlot               |<----+      +-------------------+
   *     |- axSetSlot               |     |
   *     |  …                       |     |
   *     |                          |     |      +-------------------+
   *     |                          |     +-----#|  objectPrototype  |
   *     |                          |            +-------------------+
   *     +--------------------------+            | - securityDomain  |
   *                                             +-------------------+
   *                                                       ^
   *                                                       |
   *                                                       |
   *                                                       #
   *     +-----------------+                        +------------+
   *  +-#|  Class Object   |----------------------->| tPrototype |<-----------------<--------------------+
   *  |  +-----------------+                        +------------+                  |                    |
   *  |                                                    ^                        |                    |
   *  |                                                    |                        |                    |
   *  |                                                    |--------+               |                    |
   *  |                                                    |        |               #                    #
   *  |                         +------------+             |        |      +-----------------+  +-----------------+
   *  |                         | - traits   |             #        |      |     Number      |  |      Uint       |
   *  |  +-----------------+    +------------+      +------------+  |      +-----------------+  +-----------------+
   *  +-#|   Class Class   |--->| tPrototype |#---->| dPrototype |  |      | - value         |  | - value         |
   *  |  +-----------------+    +------------+      +------------+  |      +-----------------+  +-----------------+
   *  |                                ^                            |
   *  |                                |                            |      +-----------------+  +-----------------+
   *  +--------------------------------+----------------------------+-----#|     Boolean     |  |      Array      |
   *  |                                                             |      +-----------------+  +-----------------+
   *  |                                                             |      | - value         |  | - value         |
   *  |  +-----------------+    +------------+      +------------+  |      +-----------------+  +-----------------+
   *  +-#|     Class A     |--->| tPrototype |#---->| dPrototype |#-+
   *  |  +-----------------+    +------------+      +------------+         +-----------------+  +-----------------+
   *  |                         | - traits   |--+          ^               |       Int       |  |    Function     |
   *  |                         +------------+  |          |               +-----------------+  +-----------------+
   *  |                                ^        |          |               | - value         |  | - value         |
   *  |                                |        |          +--------+      +-----------------+  +-----------------+
   *  |                                #        |                   |
   *  |                         +------------+  |   +------------+  |      +-----------------+
   *  |                         |  Object A  |  +-->|   Traits   |  |      |     String      |
   *  |                         +------------+      +------------+  |      +-----------------+
   *  |                                                             |      | - value         |
   *  |                                                             |      +-----------------+
   *  |                                                             |
   *  |                                                             |
   *  |                                                             |
   *  |                                                             |
   *  |                                                             |
   *  | +-----------------+     +------------+      +------------+  |
   *  +#|Class B extends A|---->| tPrototype |#---->| dPrototype |#-+
   *    +-----------------+     +------------+      +------------+
   *                            | - traits   |
   *                            +------------+
   *
   */

  export function checkNullParameter(argument: any, name: string, securityDomain: SecurityDomain) {
    if (!argument) {
      securityDomain.throwError('TypeError', Errors.NullPointerError, name);
    }
  }
  export function checkParameterType(argument: any, name: string, type: AS.ASClass) {
    if (argument == null) {
      return;
    }
    if (!type.axIsType(argument)) {
      type.securityDomain.throwError('TypeError', Errors.CheckTypeFailedError, argument,
                                     type.classInfo.instanceInfo.getClassName());
    }
  }
  export function wrapJSObject(object) {
    // REDUX:
    notImplemented("wrapJSObject");
    return null;
    //var wrapper = Object.create(object);
    //for (var i in object) {
    //  Object.defineProperty(wrapper, Multiname.getPublicQualifiedName(i), (function (object, i) {
    //    return {
    //      get: function () { return object[i] },
    //      set: function (value) { object[i] = value; },
    //      enumerable: true
    //    };
    //  })(object, i));
    //}
    //return wrapper;
  }

  export function forEachPublicProperty(object: AXObject, callbackfn: (property: any, value: any) => void, thisArg?: any) {
    // REDUX: Do we need to walk the proto chain here?
    var properties = object.axGetEnumerableKeys();
    for (var i = 0; i < properties.length; i++) {
      var property = properties[i];
      var value = object.axGetPublicProperty(property);
      callbackfn.call(thisArg, property, value);
    }
  }

  export enum WriterFlags {
    None = 0,
    Runtime = 1,
    Interpreter = 2
  }

  var writer = new IndentingWriter();
  export var runtimeWriter = null;
  export var interpreterWriter = null;

  export function sliceArguments(args, offset: number) {
    return Array.prototype.slice.call(args, offset);
  }

  export function setWriters(flags: WriterFlags) {
    runtimeWriter = (flags & WriterFlags.Runtime) ? writer : null;
    interpreterWriter = (flags & WriterFlags.Runtime) ? writer : null;
  }

  export enum ScriptInfoState {
    None = 0,
    Executing = 1,
    Executed = 2
  }

  import assert = Shumway.Debug.assert;
  import notImplemented = Shumway.Debug.notImplemented;

  import defineNonEnumerableProperty = Shumway.ObjectUtilities.defineNonEnumerableProperty;
  import defineReadOnlyProperty = Shumway.ObjectUtilities.defineReadOnlyProperty;

  import defineNonEnumerableGetterOrSetter = Shumway.ObjectUtilities.defineNonEnumerableGetterOrSetter;
  import getOwnPropertyDescriptor = Shumway.ObjectUtilities.getOwnPropertyDescriptor;
  import ASClass = Shumway.AVMX.AS.ASClass;

  function axBoxIdentity(args) {
    return args[0];
  }

  function axBoxPrimitive(value) {
    var boxed = Object.create(this.tPrototype);
    boxed.value = value;
    return boxed;
  }

  function axCoerceObject(x) {
    if (x == null) {
      return null;
    }
    return x;
  }

  function axApplyObject(_, args) {
    var x = args[0];
    if (x == null) {
      return Object.create(this.tPrototype);
    }
    return x;
  }

  function axConstructObject(args) {
    var x = args[0];
    if (x == null) {
      return Object.create(this.tPrototype);
    }
    return x;
  }

  export function asCoerceInt(x): number {
    return x | 0;
  }

  export function asCoerceUint(x): number {
    return x >>> 0;
  }

  export function asCoerceNumber(x): number {
    return +x;
  }

  export function asCoerceBoolean(x): boolean {
    return !!x;
  }

  /**
   * Similar to |toString| but returns |null| for |null| or |undefined| instead
   * of "null" or "undefined".
   */
  export function asCoerceString(x): string {
    if (typeof x === "string") {
      return x;
    } else if (x == undefined) {
      return null;
    }
    return x + '';
  }

  /**
   * Same as |asCoerceString| except for returning "null" instead of |null| for
   * |null| or |undefined|, and calls |toString| instead of (implicitly) |valueOf|.
   */
  export function asCoerceName(x): string {
    if (typeof x === "string") {
      return x;
    } else if (x == undefined) {
      return 'null';
    }
    return x.toString();
  }

  export function asConvertString(x): string {
    if (typeof x === "string") {
      return x;
    }
    return x + '';
  }

  export function axIsTypeNumber(x): boolean {
    return typeof x === "number";
  }

  export function axIsTypeInt(x): boolean {
    return typeof x === "number" && ((x | 0) === x);
  }

  export function axIsTypeUint(x): boolean {
    return typeof x === "number" && ((x >>> 0) === x);
  }

  export function axIsTypeBoolean(x): boolean {
    return typeof x === "boolean";
  }

  export function axIsTypeString(x): boolean {
    return typeof x === "string";
  }

  function axIsXMLCollection(x, securityDomain: SecurityDomain): boolean {
    return securityDomain.AXXML.dPrototype.isPrototypeOf(x) ||
           securityDomain.AXXMLList.dPrototype.isPrototypeOf(x);
  }

  export function axGetDescendants(object, mn: Multiname, securityDomain: SecurityDomain) {
    if (!axIsXMLCollection(object, securityDomain)) {
      securityDomain.throwError('TypeError', Errors.DescendentsError, object);
    }
    return object.descendants(mn);
  }

  export function axCheckFilter(value, securityDomain: SecurityDomain) {
    if (!value || !AS.isXMLCollection(value, securityDomain)) {
      var className = value && value.axClass ? value.axClass.name.toFQNString(false) : '[unknown]';
      this.securityDomain.throwError('RangeError', Errors.FilterError, className);
    }
    return value;
  }

  export function axFalse(): boolean {
    return false;
  }

  export function axDefaultCompareFunction(a, b) {
    return String(a).localeCompare(String(b));
  }

  export function axCompare(a: any, b: any, options: SORT, sortOrder: number,
                            compareFunction: (a, b) => number) {
    release || Shumway.Debug.assertNotImplemented(!(options & SORT.UNIQUESORT), "UNIQUESORT");
    release || Shumway.Debug.assertNotImplemented(!(options & SORT.RETURNINDEXEDARRAY),
                                                  "RETURNINDEXEDARRAY");
    var result = 0;
    if (options & SORT.CASEINSENSITIVE) {
      a = String(a).toLowerCase();
      b = String(b).toLowerCase();
    }
    if (options & SORT.NUMERIC) {
      a = +a;
      b = +b;
      result = a < b ? -1 : (a > b ? 1 : 0);
    } else {
      result = compareFunction(a, b);
    }
    return result * sortOrder;
  }

  export function axCompareFields(objA: any, objB: any, names: string[], optionsList: SORT[]) {
    release || assert(names.length === optionsList.length);
    release || assert(names.length > 0);
    var result = 0;
    var i;
    for (i = 0; i < names.length && result === 0; i++) {
      var name = names[i];
      var a = objA[name];
      var b = objB[name];
      var options = optionsList[i];
      if (options & SORT.CASEINSENSITIVE) {
        a = String(a).toLowerCase();
        b = String(b).toLowerCase();
      }
      if (options & SORT.NUMERIC) {
        a = +a;
        b = +b;
        result = a < b ? -1 : (a > b ? 1 : 0);
      } else {
        result = String(a).localeCompare(String(b));
      }
    }
    if (optionsList[i - 1] & SORT.DESCENDING) {
      result *= -1;
    }
    return result;
  }

  /**
   * ActionScript 3 has different behaviour when deciding whether to call toString or valueOf
   * when one operand is a string. Unlike JavaScript, it calls toString if one operand is a
   * string and valueOf otherwise. This sucks, but we have to emulate this behaviour because
   * YouTube depends on it.
   *
   * AS3 also overloads the `+` operator to concatenate XMLs/XMLLists instead of stringifying them.
   */
  export function asAdd(l: any, r: any, securityDomain: SecurityDomain): any {
    release || assert(!(typeof l === "number" && typeof r === "number"), 'Inline number addition.');
    if (typeof l === "string" || typeof r === "string") {
      return String(l) + String(r);
    }
    if (AS.isXMLCollection(l, securityDomain) && AS.isXMLCollection(r, securityDomain)) {
      return AS.ASXMLList.addXML(l, r);
    }
    return l + r;
  }

  export function asEquals(left: any, right: any, securityDomain: SecurityDomain): boolean {
    // See E4X spec, 11.5 Equality Operators for why this is required.
    if (AS.isXMLType(left, securityDomain)) {
      return left.equals(right);
    }
    if (AS.isXMLType(right, securityDomain)) {
      return right.equals(left);
    }
    return left == right;
  }

  /**
   * These values are allowed to exist without being boxed.
   */
  function isPrimitiveJSValue(value: any) {
    return value === null || value === undefined || typeof value === "number" ||
           typeof value === "string" || typeof value === "boolean";

  }

  export function isValidASValue(value: any) {
    return AXBasePrototype.isPrototypeOf(value) || isPrimitiveJSValue(value);
  }

  export function checkValue(value: any) {
    if (!release) {
      if (!isValidASValue(value)) {
        // Stringifying the value is potentially costly, so only do it if necessary,
        // even in debug mode.
        assert(false, "Value: " + value + " is not allowed to flow into AS3.");
      }
    }
  }

  export function axCheckVectorSetNumericProperty(i: number, length: number, fixed: boolean,
                                                  securityDomain: SecurityDomain) {
    if (i < 0 || i > length || (i === length && fixed) || !isNumeric(i)) {
      securityDomain.throwError("RangeError", Errors.OutOfRangeError, i, length);
    }
  }

  export function axCheckVectorGetNumericProperty(i: number, length: number,
                                                  securityDomain: SecurityDomain) {
    if (i < 0 || i >= length || !isNumeric(i)) {
      securityDomain.throwError("RangeError", Errors.OutOfRangeError, i, length);
    }
  }

  var rn = new Multiname(null, 0, CONSTANT.RTQNameL, [Namespace.PUBLIC], null);

  function axFunctionConstruct(argArray?: any []) {
    release || assert(this.prototype);
    var object = Object.create(this.prototype);
    this.value.apply(object, argArray);
    return object;
  }

  export function axTypeOf(x: any, securityDomain: SecurityDomain): string {
    // ABC doesn't box primitives, so typeof returns the primitive type even when
    // the value is new'd
    if (x) {
      if (x.value) {
        return typeof x.value;
      }
      if (axIsXMLCollection(x, securityDomain)) {
        return "xml";
      }
    }
    return typeof x;
  }

  function axCoerce(x: any) {
    if (isNullOrUndefined(x)) {
      return null;
    }
    if (!this.axIsType(x)) {
      this.securityDomain.throwError('TypeError', Errors.CheckTypeFailedError, x,
                                     this.classInfo.instanceInfo.getClassName());
    }
    return x;
  }

  function axImplementsInterface(type: AXClass) {
    var interfaces = (<AXClass>this).classInfo.instanceInfo.getInterfaces(this.axClass);
    return interfaces.has(type);
  }

  function axIsTypeObject(x: any) {
    // FIXME
    return this.dPrototype.isPrototypeOf(this.securityDomain.box(x));
  }

  function axIsTypeInterface(x: any) {
    if (!x || typeof x !== 'object') {
      return false;
    }
    release || checkValue(x);
    return (<AXClass>x).axImplementsInterface(this);
  }

  function axAsType(x: any): any {
    return this.axIsType(x) ? x : null;
  }

  function axIsInstanceOfObject(x: any) {
    return this.dPrototype.isPrototypeOf(this.securityDomain.box(x));
  }

  function axIsInstanceOfInterface(x: any) {
    return false;
  }

  /**
   * All objects with Traits must implement this interface.
   */
  export interface ITraits {
    traits: RuntimeTraits;
    securityDomain: SecurityDomain;
  }

  export class Scope {
    parent: Scope;
    global: Scope;
    object: AXObject;
    isWith: boolean;
    cache: any;

    constructor(parent: Scope, object: any, isWith: boolean = false) {
      this.parent = parent;
      this.object = object;
      this.global = parent ? parent.global : this;
      this.isWith = isWith;
      this.cache = [];
    }

    public findDepth(object: any): number {
      var current = this;
      var depth = 0;
      while (current) {
        if (current.object === object) {
          return depth;
        }
        depth++;
        current = current.parent;
      }
      return -1;
    }

    public getScopeObjects(): Object [] {
      var objects = [];
      var current = this;
      while (current) {
        objects.unshift(current.object);
        current = current.parent;
      }
      return objects;
    }

    public getScopeProperty(mn: Multiname, strict: boolean, scopeOnly: boolean): any {
      return this.findScopeProperty(mn, strict, scopeOnly).axGetProperty(mn);
    }

    public findScopeProperty(mn: Multiname, strict: boolean, scopeOnly: boolean): any {
      var object;
      if (!scopeOnly && !mn.isRuntime()) {
        if ((object = this.cache[mn.id])) {
          return object;
        }
      }
      // Scope lookups should not be trapped by proxies.
      if (this.object.axHasPropertyInternal(mn)) {
        return (this.isWith || mn.isRuntime()) ? this.object : (this.cache[mn.id] = this.object);
      }
      if (this.parent) {
        var object = this.parent.findScopeProperty(mn, strict, scopeOnly);
        if (mn.kind === CONSTANT.QName) {
          this.cache[mn.id] = object;
        }
        return object;
      }
      if (scopeOnly) {
        return null;
      }

      // Attributes can't be stored on globals or be directly defined in scripts.
      if (mn.isAttribute()) {
        this.object.securityDomain.throwError("ReferenceError", Errors.UndefinedVarError, mn.name);
      }

      // If we can't find the property look in the domain.
      var globalObject = <AXGlobal><any>this.global.object;
      if ((object = globalObject.applicationDomain.findProperty(mn, strict, true))) {
        return object;
      }

      // If we still haven't found it, look for dynamic properties on the global.
      // No need to do this for non-strict lookups as we'll end up returning the
      // global anyways.
      if (strict) {
        if (!(mn.getPublicMangledName() in globalObject)) {
          this.object.securityDomain.throwError("ReferenceError", Errors.UndefinedVarError, mn.name);
        }
      }

      // Can't find it still, return the global object.
      return globalObject;
    }
  }

  export function applyTraits(object: ITraits, traits: RuntimeTraits) {
    release || assert(!object.hasOwnProperty("traits"));
    defineReadOnlyProperty(object, "traits", traits);
    var T = traits.traits;
    for (var i = 0; i < T.length; i++) {
      var t = T[i];
      var p: PropertyDescriptor = t;
      if (p.value instanceof Namespace) {
        // We can't call |object.securityDomain.AXNamespace.FromNamespace(...)| because the
        // AXNamespace class may not have been loaded yet. However, at this point we do have a
        // valid reference to |object.securityDomain.AXNamespace| because |prepareNativeClass| has
        // been called.
        p = { value: AS.ASNamespace.FromNamespace.call(object.securityDomain.AXNamespace, p.value) };
      }
      if (!release && (t.kind === TRAIT.Slot || t.kind === TRAIT.Const)) {
        checkValue(p.value);
      }
      Object.defineProperty(object, t.name.getMangledName(), p);
    }
  }

  var D = defineNonEnumerableProperty;

  // The Object that's at the root of all AXObjects' prototype chain, regardless of their
  // SecurityDomain.
  export var AXBasePrototype = null;

  /**
   * Execute this lazily because we want to make sure the AS package is available.
   */
  function initializeAXBasePrototype() {
    if (AXBasePrototype) {
      return;
    }
    var Op = AS.ASObject.prototype;
    AXBasePrototype = Object.create(null);
    D(AXBasePrototype, "axHasPropertyInternal", Op.axHasPropertyInternal);
    D(AXBasePrototype, "axHasProperty", Op.axHasProperty);
    D(AXBasePrototype, "axSetProperty", Op.axSetProperty);
    D(AXBasePrototype, "axHasProperty", Op.axHasProperty);
    D(AXBasePrototype, "axHasPublicProperty", Op.axHasPublicProperty);
    D(AXBasePrototype, "axSetPublicProperty", Op.axSetPublicProperty);
    D(AXBasePrototype, "axGetPublicProperty", Op.axGetPublicProperty);
    D(AXBasePrototype, "axCallPublicProperty", Op.axCallPublicProperty);
    D(AXBasePrototype, "axGetProperty", Op.axGetProperty);
    D(AXBasePrototype, "axDeleteProperty", Op.axDeleteProperty);
    D(AXBasePrototype, "axGetSuper", Op.axGetSuper);
    D(AXBasePrototype, "axSetSuper", Op.axSetSuper);
    D(AXBasePrototype, "axSetSlot", Op.axSetSlot);
    D(AXBasePrototype, "axGetSlot", Op.axGetSlot);
    D(AXBasePrototype, "axCallProperty", Op.axCallProperty);
    D(AXBasePrototype, "axCallSuper", Op.axCallSuper);
    D(AXBasePrototype, "axConstructProperty", Op.axConstructProperty);
    D(AXBasePrototype, "axResolveMultiname", Op.axResolveMultiname);
    D(AXBasePrototype, "axNextNameIndex", Op.axNextNameIndex);
    D(AXBasePrototype, "axNextName", Op.axNextName);
    D(AXBasePrototype, "axNextValue", Op.axNextValue);
    D(AXBasePrototype, "axGetEnumerableKeys", Op.axGetEnumerableKeys);
    D(AXBasePrototype, "axImplementsInterface", axImplementsInterface);

    // Dummy traits object so Object.prototype lookups succeed.
    D(AXBasePrototype, "traits", new RuntimeTraits([], null, null, Object.create(null)));

    // Helper methods borrowed from Object.prototype.
    D(AXBasePrototype, "isPrototypeOf", Object.prototype.isPrototypeOf);
    D(AXBasePrototype, "hasOwnProperty", Object.prototype.hasOwnProperty);

    AXBasePrototype.$BgtoString = function () {
      // Dynamic prototypes just return [object Object], so we have to special-case them.
      // Since the dynamic object is the one holding the direct reference to `classInfo`,
      // we can check for that.
      var name = this.hasOwnProperty('classInfo') ?
                 'Object' :
                 this.classInfo.instanceInfo.name.name;
      return Shumway.StringUtilities.concat3("[object ", name, "]");
    };
    AXBasePrototype.toString = function () {
      return this.$BgtoString.axCall(this);
    };
    AXBasePrototype.$BgvalueOf = function () {
      return this;
    };
    AXBasePrototype.valueOf = function () {
      return this.$BgvalueOf.axCall(this);
    };
  }

  export interface AXObject extends ITraits, IMetaobjectProtocol {
    $BgtoString: AXCallable;
    $BgvalueOf: AXCallable;
    axInitializer: any;
    axClass: AXClass;
  }

  export interface AXGlobal extends AXObject {
    securityDomain: SecurityDomain;
    applicationDomain: ApplicationDomain;
    scriptInfo: ScriptInfo;
    scope: Scope;
  }

  export interface AXClass extends AXObject {
    scope: Scope;
    asClass: ASClass;
    superClass: AXClass;
    classInfo: ClassInfo;
    name: Multiname;
    // Used to initialize Vectors.
    defaultValue: any;
    tPrototype: AXObject;
    dPrototype: AXObject;
    axBox: any;
    axConstruct: (args: any[]) => AXObject;
    axApply: any;
    axCoerce: any;
    axIsType: any;
    axAsType: any;
    axIsInstanceOf: any;
    axImplementsInterface: (x: AXClass) => boolean;
  }

  export interface AXFunction extends AXObject {
    axApply(thisArg: any, argArray?: any[]): any;
    axCall(thisArg: any): any;
    value;
  }

  export interface AXMethodClosureClass extends AXClass {
    Create(receiver: AXObject, method: Function): AXFunction;
  }

  export interface AXXMLClass extends AXClass {
    Create(value?: any): AS.ASXML;
    _flags: number;
    _prettyIndent: number;
    prettyPrinting: boolean;
    ignoreComments: boolean;
    ignoreWhitespace: boolean;
    ignoreProcessingInstructions: boolean;
  }

  export interface AXXMLListClass extends AXClass {
    Create(value?: any): AS.ASXMLList;
    CreateList(targetObject: AS.ASXML, targetProperty: Multiname): AS.ASXMLList;
  }

  export interface AXNamespaceClass extends AXClass {
    Create(uriOrPrefix?: any, uri?: any): AS.ASNamespace;
    FromNamespace(ns: Namespace): AS.ASNamespace;
    defaultNamespace: Namespace;
  }

  export interface AXQNameClass extends AXClass {
    Create(nameOrNS?: any, name?: any): AS.ASQName;
    FromMultiname(mn: Multiname): AS.ASQName;
  }

  /**
   * Can be used wherever both AXFunctions and raw JS functions are valid values.
   */
  export interface AXCallable {
    axApply(thisArg: any, argArray?: any[]): any;
    axCall(thisArg: any): any;
  }

  // Add the |axApply| and |axCall| methods on the function prototype so that we can treat
  // Functions as AXCallables.
  Function.prototype.axApply = Function.prototype.apply;
  Function.prototype.axCall = Function.prototype.call;

  export interface AXActivation extends ITraits {

  }

  export interface AXCatch extends ITraits {

  }

  /**
   * Make sure we bottom out at the securityDomain's objectPrototype.
   */
  export function safeGetPrototypeOf(object: AXObject): AXObject {
    var axClass = object.axClass;
    if (!axClass || axClass === axClass.securityDomain.AXObject) {
      return null;
    }

    var prototype = axClass.dPrototype;
    if (prototype === object) {
      prototype = axClass.superClass.dPrototype;
    }
    release || assert(prototype.securityDomain);
    return prototype;
  }

  export class HasNext2Info {
    constructor(public object: AXObject, public index: number) {
      // ...
    }

    /**
     * Determine if the given object has any more properties after the specified |index| and if so,
     * return the next index or |zero| otherwise. If the |obj| has no more properties then continue
     * the search in
     * |obj.__proto__|. This function returns an updated index and object to be used during
     * iteration.
     *
     * the |for (x in obj) { ... }| statement is compiled into the following pseudo bytecode:
     *
     * index = 0;
     * while (true) {
     *   (obj, index) = hasNext2(obj, index);
     *   if (index) { #1
     *     x = nextName(obj, index); #2
     *   } else {
     *     break;
     *   }
     * }
     *
     * #1 If we return zero, the iteration stops.
     * #2 The spec says we need to get the nextName at index + 1, but it's actually index - 1, this
     * caused me two hours of my life that I will probably never get back.
     *
     * TODO: We can't match the iteration order semantics of Action Script, hopefully programmers
     * don't rely on it.
     */
    next(object: AXObject, index: number) {
      if (isNullOrUndefined(object)) {
        this.index = 0;
        this.object = null;
        return;
      } else {
        this.object = object;
        this.index = index;
      }
      var nextIndex = object.axNextNameIndex(this.index);
      if (nextIndex > 0) {
        this.index = nextIndex;
        return;
      }
      // If there are no more properties in the object then follow the prototype chain.
      while (true) {
        var object = safeGetPrototypeOf(object);
        if (!object) {
          this.index = 0;
          this.object = null;
          return;
        }
        nextIndex = object.axNextNameIndex(0);
        if (nextIndex > 0) {
          this.index = nextIndex;
          this.object = object;
          return;
        }
      }
    }
  }

  /**
   * Generic axConstruct method that lives on the AXClass prototype. This just
   * creates an empty object with the right prototype and then calls the
   * instance initializer.
   *
   * TODO: Flatten out the argArray, or create an alternate ax helper to
   * make object construction faster.
   */
  function axConstruct(argArray?: any[]) {
    var object = Object.create(this.tPrototype);
    object.axInitializer.apply(object, argArray);
    return object;
  }

  /**
   * Default initializer.
   */
  function axDefaultInitializer() {
    // Nop.
  }

  /**
   * Throwing initializer for interfaces.
   */
  function axInterfaceInitializer() {
    this.securityDomain.throwError("VerifierError", Errors.NotImplementedError, this.name.name);
  }

  /**
   * Default axApply.
   */
  function axDefaultApply(self, args: any []) {
    return this.axCoerce(args ? args[0] : undefined);
  }

  /**
   * Provides security isolation between application domains.
   */
  export class SecurityDomain {
    public system: ApplicationDomain;
    public classAliases: AliasesCache;
    public application: ApplicationDomain;
    public AXObject: AXClass;
    public AXArray: AXClass;
    public AXClass: AXClass;
    public AXFunction: AXClass;
    public AXMethodClosure: AXMethodClosureClass;
    public AXError: AXClass;
    public AXNumber: AXClass;
    public AXString: AXClass;
    public AXBoolean: AXClass;
    public AXRegExp: AXClass;
    public AXMath: AXClass;
    public AXDate: AXClass;

    public AXXML: AXXMLClass;
    public AXXMLList: AXXMLListClass;
    public AXNamespace: AXNamespaceClass;
    public AXQName: AXQNameClass;

    public ObjectVector: typeof AS.GenericVector;
    public Int32Vector: typeof AS.Int32Vector;
    public Uint32Vector: typeof AS.Uint32Vector;
    public Float64Vector: typeof AS.Float64Vector;

    public get xmlParser(): AS.XMLParser {
      return this._xmlParser || (this._xmlParser = new AS.XMLParser(this));
    }

    private _xmlParser: AS.XMLParser;

    private AXPrimitiveBox;
    private AXGlobalPrototype;
    private AXActivationPrototype;
    private AXCatchPrototype;

    public objectPrototype: AXObject;
    private rootClassPrototype: AXObject;

    private nativeClasses: any;
    private vectorClasses: Map<AXClass, AXClass>;

    private _catalogs: ABCCatalog [];

    constructor() {
      initializeAXBasePrototype();
      this.system = new ApplicationDomain(this, null);
      this.classAliases = new AliasesCache();
      this.application = new ApplicationDomain(this, this.system);
      this.nativeClasses = Object.create(null);
      this.vectorClasses = new Map<AXClass, AXClass>();
      this._catalogs = [];
    }

    addCatalog(abcCatalog: ABCCatalog) {
      this._catalogs.push(abcCatalog);
    }

    findDefiningABC(mn: Multiname): ABCFile {
      runtimeWriter && runtimeWriter.writeLn("findDefiningABC: " + mn);
      var abcFile = null;
      for (var i = 0; i < this._catalogs.length; i++) {
        var abcCatalog = this._catalogs[i];
        abcFile = abcCatalog.getABCByMultiname(mn);
        if (abcFile) {
          return abcFile;
        }
      }
      return null;
    }

    throwError(className: string, error: any, replacement1?: any,
               replacement2?: any, replacement3?: any, replacement4?: any) {
      throw this.createError.apply(this, arguments);
    }

    createError(className: string, error: any, replacement1?: any,
               replacement2?: any, replacement3?: any, replacement4?: any) {
      var message = formatErrorMessage.apply(null, sliceArguments(arguments, 1));
      var mn = new Multiname(null, 0, CONSTANT.RTQNameL, [Namespace.PUBLIC], className);
      var axClass: AXClass = <any>this.application.getProperty(mn, true, true);
      return axClass.axConstruct([message, error.code]);
    }

    applyType(axClass: AXClass, types: AXClass []): AXClass {
      release || assert(axClass.classInfo.instanceInfo.getName().name === "Vector");
      release || assert(types.length === 1);
      var type = types[0] || this.AXObject;
      return this.getVectorClass(type);
    }

    getVectorClass(type: AXClass): AXClass {
      var vectorClass = this.vectorClasses.get(type);
      if (vectorClass) {
        return vectorClass;
      }
      var typeClassName = type ?
                          type.classInfo.instanceInfo.getName().getMangledName() :
                          '$BgObject';
      switch (typeClassName) {
        case "$BgNumber":
        case "$Bgdouble":
          vectorClass = <any>this.Float64Vector.axClass;
          break;
        case "$Bgint":
          vectorClass = <any>this.Int32Vector.axClass;
          break;
        case "$Bguint":
          vectorClass = <any>this.Uint32Vector.axClass;
          break;
        default:
          vectorClass = this.createVectorClass(type);
      }
      this.vectorClasses.set(type, vectorClass);
      return vectorClass;
    }

    createVectorClass(type: AXClass): AXClass {
      var genericVectorClass = this.ObjectVector.axClass;
      var axClass: AXClass = Object.create(genericVectorClass);
      // Put the superClass tPrototype on the prototype chain so we have access
      // to all factory protocol handlers by default.
      axClass.tPrototype = Object.create(genericVectorClass.tPrototype);
      axClass.tPrototype.axClass = axClass;
      // We don't need a new dPrototype object.
      axClass.dPrototype = <any>genericVectorClass.dPrototype;
      axClass.superClass = <any>genericVectorClass;
      (<any>axClass).type = type;
      return axClass;
    }

    /**
     * Constructs a plain vanilla object in this security domain.
     */
    createObject() {
      return Object.create(this.AXObject.tPrototype);
    }

    /**
     * Constructs an AXArray in this security domain and sets its value to the given array.
     */
    createArray(value: any[]) {
      var array = Object.create(this.AXArray.tPrototype);
      array.value = value;
      return array;
    }

    /**
     * Constructs an AXFunction in this security domain and sets its value to the given function.
     */
    boxFunction(value: Function) {
      var fn = Object.create(this.AXFunction.tPrototype);
      fn.value = value;
      return fn;
    }

    createClass(classInfo: ClassInfo, superClass: AXClass, scope: Scope): AXClass {
      var instanceInfo = classInfo.instanceInfo;
      var className = instanceInfo.getName().name;
      var axClass: AXClass = this.nativeClasses[className] ||
                             Object.create(this.AXClass.tPrototype);
      var classScope = new Scope(scope, axClass);
      if (!this.nativeClasses[className]) {
        if (instanceInfo.isInterface()) {
          axClass.dPrototype = Object.create(this.objectPrototype);
          axClass.tPrototype = Object.create(axClass.dPrototype);
          axClass.tPrototype.axInitializer = axInterfaceInitializer;
          axClass.axIsInstanceOf = axIsInstanceOfInterface;
          axClass.axIsType = axIsTypeInterface;
        } else {
          // For direct descendants of Object, we want the dynamic prototype to inherit from
          // Object's tPrototype because Foo.prototype is always a proper instance of Object.
          // For all other cases, the dynamic prototype should extend the parent class's
          // dynamic prototype not the tPrototype.
          if (superClass === this.AXObject) {
            axClass.dPrototype = Object.create(this.objectPrototype);
          } else {
            axClass.dPrototype = Object.create(superClass.dPrototype);
          }
          axClass.tPrototype = Object.create(axClass.dPrototype);
          axClass.tPrototype.axInitializer = this.createInitializerFunction(classInfo, classScope);
        }
      } else {
        axClass.tPrototype.axInitializer = this.createInitializerFunction(classInfo, classScope);
        // Native classes have their inheritance structure set up during initial SecurityDomain
        // creation.
        release || assert(axClass.dPrototype);
        release || assert(axClass.tPrototype);
      }

      axClass.classInfo = (<any>axClass.dPrototype).classInfo = classInfo;
      (<any>axClass.dPrototype).axClass = axClass;
      axClass.superClass = superClass;
      axClass.scope = scope;

      // Object and Class have their traits initialized earlier to avoid circular dependencies.
      if (className !== 'Object' && className !== 'Class') {
        this.initializeRuntimeTraits(axClass, superClass, classScope);
      }

      // Add the |constructor| property on the class dynamic prototype so that all instances can
      // get to their class constructor, and FooClass.prototype.constructor returns FooClass.
      defineNonEnumerableProperty(axClass.dPrototype, "$Bgconstructor", axClass);

      // Copy over all TS symbols.
      AS.tryLinkNativeClass(axClass);

      // Run the static initializer.
      interpret(axClass, classInfo.getInitializer(), classScope, [axClass]);
      return axClass;
    }

    private initializeRuntimeTraits(axClass: AXClass, superClass: AXClass, scope: Scope) {
      var classInfo = axClass.classInfo;
      var instanceInfo = classInfo.instanceInfo;

      // Prepare class traits.
      var classTraits: RuntimeTraits;
      if (axClass === this.AXClass) {
        classTraits = instanceInfo.traits.resolveRuntimeTraits(null, null, scope);
      } else {
        var rootClassTraits = this.AXClass.classInfo.instanceInfo.runtimeTraits;
        release || assert(rootClassTraits);
        classTraits = classInfo.traits.resolveRuntimeTraits(rootClassTraits, null, scope);
      }
      classInfo.runtimeTraits = classTraits;
      applyTraits(axClass, classTraits);

      // Prepare instance traits.
      var superInstanceTraits = superClass ? superClass.classInfo.instanceInfo.runtimeTraits : null;
      var protectedNs = classInfo.abc.getNamespace(instanceInfo.protectedNs);
      var instanceTraits = instanceInfo.traits.resolveRuntimeTraits(superInstanceTraits,
                                                                    protectedNs, scope);
      instanceInfo.runtimeTraits = instanceTraits;
      applyTraits(axClass.tPrototype, instanceTraits);
    }

    createFunction(methodInfo: MethodInfo, scope: Scope, hasDynamicScope: boolean): AXFunction {
      var fun = this.boxFunction(function () {
        var self = this === jsGlobal ? scope.global.object : this;
        return interpret(self, methodInfo, scope, <any>arguments);
      });
      fun.receiver = {scope: scope};
      return fun;
    }

    createMethodClosure(receiver: AXObject, method: Function): AXFunction {
      return this.AXMethodClosure.Create(receiver, method);
    }

    isCallable(value): boolean {
      if (typeof value === 'function') {
        return true;
      }
      if (typeof value !== 'object' || !AXBasePrototype.isPrototypeOf(value)) {
        return false;
      }
      // The value might not come from this securityDomain, but still be a callable from another.
      return value.securityDomain.AXFunction.dPrototype.isPrototypeOf(value);
    }

    createQName(namespace: any, localName: any): AS.ASQName {
      return this.AXQName.Create(namespace, localName);
    }

    createInitializerFunction(classInfo: ClassInfo, scope: Scope): Function {
      var nativeInitializer = AS.getNativeInitializer(classInfo);
      if (nativeInitializer) {
        return nativeInitializer;
      }
      var methodInfo = classInfo.instanceInfo.getInitializer();
      release || assert(!methodInfo.isNative(), "Must provide a native initializer for " + classInfo.instanceInfo.getClassName());
      return function () {
        return interpret(this, methodInfo, scope, <any>arguments);
      };
    }

    createActivation(methodInfo: MethodInfo, scope: Scope): AXActivation {
      var body = methodInfo.getBody();
      if (!body.activationPrototype) {
        body.traits.resolve();
        body.activationPrototype = Object.create(this.AXActivationPrototype);
        defineReadOnlyProperty(body.activationPrototype, "traits", body.traits.resolveRuntimeTraits(null, null, scope));
      }
      return Object.create(body.activationPrototype);
    }

    createCatch(exceptionInfo: ExceptionInfo, scope: Scope): AXCatch {
      if (!exceptionInfo.catchPrototype) {
        var traits = exceptionInfo.getTraits();
        exceptionInfo.catchPrototype = Object.create(this.AXCatchPrototype);
        defineReadOnlyProperty(exceptionInfo.catchPrototype, "traits", traits.resolveRuntimeTraits(null, null, scope));
      }
      return Object.create(exceptionInfo.catchPrototype);
    }

    box(v: any) {
      if (v == undefined) {
        return v;
      }
      if (AXBasePrototype.isPrototypeOf(v)) {
        return v;
      }
      if (v instanceof Array) {
        return this.AXArray.axBox(v);
      }
      if (typeof v === "number") {
        return this.AXNumber.axBox(v);
      }
      if (typeof v === "boolean") {
        return this.AXBoolean.axBox(v);
      }
      if (typeof v === "string") {
        return this.AXString.axBox(v);
      }
      assert(false, "Cannot box: " + v);
    }

    isPrimitive(v: any) {
      return isPrimitiveJSValue(v) || this.AXPrimitiveBox.dPrototype.isPrototypeOf(v);
    }

    createAXGlobal(applicationDomain: ApplicationDomain, scriptInfo: ScriptInfo) {
      var global: AXGlobal = Object.create(this.AXGlobalPrototype);
      global.securityDomain = this;
      global.applicationDomain = applicationDomain;
      global.scriptInfo = scriptInfo;

      var scope = global.scope = new Scope(null, global, false);
      var objectTraits = this.AXObject.classInfo.instanceInfo.runtimeTraits;
      var traits = scriptInfo.traits.resolveRuntimeTraits(objectTraits, null, scope);
      applyTraits(global, traits);
      return global;
    }

    /**
     * Prepares the dynamic Class prototype that all Class instances (including Class) have in
     * their prototype chain.
     *
     * This prototype defines the default hooks for all classes. Classes can override some or
     * all of them.
     */
    prepareRootClassPrototype() {
      var dynamicClassPrototype: AXObject = Object.create(this.objectPrototype);
      var rootClassPrototype: AXObject = Object.create(dynamicClassPrototype);
      rootClassPrototype.$BgtoString = function axClassToString() {
        return "[class " + this.classInfo.instanceInfo.getName().name + "]";
      };

      var D = defineNonEnumerableProperty;
      D(rootClassPrototype, "axBox", axBoxIdentity);
      D(rootClassPrototype, "axCoerce", axCoerce);
      D(rootClassPrototype, "axIsType", axIsTypeObject);
      D(rootClassPrototype, "axAsType", axAsType);
      D(rootClassPrototype, "axIsInstanceOf", axIsInstanceOfObject);
      D(rootClassPrototype, "axConstruct", axConstruct);
      D(rootClassPrototype, "axApply", axDefaultApply);
      Object.defineProperty(rootClassPrototype, 'name', {
        get: function () {
          return this.classInfo.instanceInfo.name;
        }
      });

      this.rootClassPrototype = rootClassPrototype;
    }

    private initializeCoreNatives() {
      // Some facts:
      // - The Class constructor is itself an instance of Class.
      // - The Class constructor is an instance of Object.
      // - The Object constructor is an instance of Class.
      // - The Object constructor is an instance of Object.

      this.prepareRootClassPrototype();
      var AXClass = this.prepareNativeClass("AXClass", "Class", false);
      AXClass.classInfo = this.system.findClassInfo("Class");
      AXClass.defaultValue = null;

      var AXObject = this.prepareNativeClass("AXObject", "Object", false);
      AXObject.classInfo = this.system.findClassInfo("Object");

      var AXObject = this.AXObject;

      // AXFunction needs to exist for runtime trait resolution.
      var AXFunction = this.prepareNativeClass("AXFunction", "Function", false);
      defineNonEnumerableProperty(AXFunction, "axBox", axBoxPrimitive);

      // Initialization of the core classes' traits is a messy multi-step process:

      // First, create a scope for looking up all the things.
      var scope = new Scope(null, AXClass, false);

      // Then, create the runtime traits all Object instances share.
      var objectCI = this.AXObject.classInfo;
      var objectII = objectCI.instanceInfo;
      var objectRTT = objectII.runtimeTraits = objectII.traits.resolveRuntimeTraits(null, null,
                                                                                    scope);
      applyTraits(this.AXObject.tPrototype, objectRTT);

      // Building on that, create the runtime traits all Class instances share.
      var classCI = this.AXClass.classInfo;
      var classII = classCI.instanceInfo;
      classII.runtimeTraits = classII.traits.resolveRuntimeTraits(objectRTT, null, scope);
      applyTraits(this.AXClass.tPrototype, classII.runtimeTraits);

      // As sort of a loose end, also create the one class trait Class itself has.
      classCI.runtimeTraits = classCI.traits.resolveRuntimeTraits(objectRTT, null, scope);
      applyTraits(this.AXClass, classCI.runtimeTraits);

      // Now we can create Object's runtime class traits.
      objectCI.runtimeTraits = objectCI.traits.resolveRuntimeTraits(classII.runtimeTraits, null,
                                                                    scope);
      applyTraits(this.AXObject, objectCI.runtimeTraits);
      return AXObject;
    }

    prepareNativeClass(exportName: string, name: string, isPrimitiveClass: boolean) {
      var axClass: AXClass = Object.create(this.rootClassPrototype);

      // For Object and Class, we've already created the instance prototype to break
      // circular dependencies.
      if (name === 'Object') {
        axClass.dPrototype = <any>Object.getPrototypeOf(this.objectPrototype);
        axClass.tPrototype = this.objectPrototype;
      } else if (name === 'Class') {
        axClass.dPrototype = <any>Object.getPrototypeOf(this.rootClassPrototype);
        axClass.tPrototype = this.rootClassPrototype;
      } else {
        var instancePrototype = isPrimitiveClass ?
                                this.AXPrimitiveBox.dPrototype :
                                name === 'MethodClosure' ?
                                  this.AXFunction.dPrototype :
                                  this.objectPrototype;
        axClass.dPrototype = Object.create(instancePrototype);
        axClass.tPrototype = Object.create(axClass.dPrototype);
      }
      this[exportName] = this.nativeClasses[name] = axClass;
      return axClass;
    }

    preparePrimitiveClass(exportName: string, name: string, convert, defaultValue, coerce,
                          isType, isInstanceOf) {
      var axClass = this.prepareNativeClass(exportName, name, true);
      var D = defineNonEnumerableProperty;
      D(axClass, 'axBox', axBoxPrimitive);
      D(axClass, "axApply", function axApply(_ , args: any []) {
        return convert(args && args.length ? args[0] : defaultValue);
      });
      D(axClass, "axConstruct", function axConstruct(args: any []) {
        return convert(args && args.length ? args[0] : defaultValue);
      });
      D(axClass, "axCoerce", coerce);
      D(axClass, "axIsType", isType);
      D(axClass, "axIsInstanceOf", isInstanceOf);
      D(axClass.dPrototype, "value", defaultValue);
      return axClass;
    }

    /**
     * Configures all the builtin Objects.
     */
    initialize() {
      var D = defineNonEnumerableProperty;
      var P = function setPublicProperty(object, name, value) {
        defineNonEnumerableProperty(object, Multiname.getPublicMangledName(name),
                                    AXFunction.axBox(value));
      };
      
      // The basic dynamic prototype that all objects in this security domain have in common.
      var dynamicObjectPrototype = Object.create(AXBasePrototype);
      dynamicObjectPrototype.securityDomain = this;
      // The basic traits prototype that all objects in this security domain have in common.
      this.objectPrototype = Object.create(dynamicObjectPrototype);
      this.initializeCoreNatives();

      // Debugging Helper
      release || (this.objectPrototype['trace'] = function trace() {
        var self = this;
        var writer = new IndentingWriter();
        this.traits.traits.forEach(t => {
          writer.writeLn(t + ": " + self[t.getName().getMangledName()]);
        });
      });

      this.AXGlobalPrototype = Object.create(this.objectPrototype);
      this.AXGlobalPrototype.$BgtoString = function() {
        return '[object global]';
      };

      this.AXActivationPrototype = Object.create(this.objectPrototype);
      this.AXActivationPrototype.$BgtoString = function() {
        return '[Activation]';
      };

      this.AXCatchPrototype = Object.create(this.objectPrototype);
      this.AXCatchPrototype.$BgtoString = function() {
        return '[Catch]';
      };

      // The core classes' MOP hooks and dynamic prototype methods are defined
      // here to keep all the hooks initialization in one place.
      var AXObject = this.AXObject;
      var AXFunction = this.AXFunction;

      // Object(null) creates an object, and this behaves differently than:
      // (function (x: Object) { trace (x); })(null) which prints null.
      D(AXObject, "axApply", axApplyObject);
      D(AXObject, "axConstruct", axConstructObject);
      D(AXObject.tPrototype, "axInitializer", axDefaultInitializer);
      D(AXObject, "axCoerce", axCoerceObject);
      D(AXFunction, "axConstruct", function() {
        return Object.create(this.tPrototype);
      });
      D(AXFunction.dPrototype, "axConstruct", axFunctionConstruct);
      D(AXFunction.dPrototype, "value", function(){
        //..
      });

      D(AXFunction.dPrototype, "axCall", AS.ASFunction.prototype.axCall);
      D(AXFunction.dPrototype, "axApply", AS.ASFunction.prototype.axApply);

      P(AXFunction.dPrototype, "call", function (self, a, b, c) {
        if (this.securityDomain.isPrimitive(self)) {
          self = null;
        }
        switch (arguments.length) {
          case 0: return this.value.call();
          case 1: return this.value.call(self);
          case 2: return this.value.call(self, a);
          case 3: return this.value.call(self, a, b);
          case 4: return this.value.call(self, a, b, c);
        }
        return this.value.apply(self, sliceArguments(arguments, 1));
      });

      P(AXFunction.dPrototype, "apply", function (self, args) {
        if (this.securityDomain.isPrimitive(self)) {
          self = null;
        }
        return this.value.apply(self, args.value);
      });

      this.prepareNativeClass("AXMethodClosure", "MethodClosure", false);
      this.prepareNativeClass("AXError", "Error", false);
      this.prepareNativeClass("AXRegExp", "RegExp", false);

      this.prepareNativeClass("AXMath", "Math", false);
      this.prepareNativeClass("AXDate", "Date", false);

      this.prepareNativeClass("AXXML", "XML", false);
      this.prepareNativeClass("AXXMLList", "XMLList", false);
      this.prepareNativeClass("AXQName", "QName", false);
      this.prepareNativeClass("AXNamespace", "Namespace", false);

      var AXArray = this.prepareNativeClass("AXArray", "Array", false);
      D(AXArray, 'axBox', axBoxPrimitive);
      AXArray.tPrototype.$BgtoString = AXFunction.axBox(function () {
        return this.value.toString();
      });
      // Array.prototype is an Array, and behaves like one.
      AXArray.dPrototype['value'] = [];

      // Boolean, int, Number, String, and uint are primitives in AS3. We create a placeholder
      // base class to help us with instanceof tests.
      var AXPrimitiveBox = this.prepareNativeClass("AXPrimitiveBox", "PrimitiveBox", false);
      D(AXPrimitiveBox.dPrototype, '$BgtoString',
        AXFunction.axBox(function () { return this.value.toString(); }));
      var AXBoolean = this.preparePrimitiveClass("AXBoolean", "Boolean", asCoerceBoolean, false,
                                                 asCoerceBoolean, axIsTypeBoolean, axIsTypeBoolean);

      var AXString = this.preparePrimitiveClass("AXString", "String", asConvertString, '',
                                                 asCoerceString, axIsTypeString, axIsTypeString);

      var AXNumber = this.preparePrimitiveClass("AXNumber", "Number", asCoerceNumber, 0,
                                                asCoerceNumber, axIsTypeNumber, axIsTypeNumber);

      var AXInt = this.preparePrimitiveClass("AXInt", "int", asCoerceInt, 0, asCoerceInt,
                                             axIsTypeInt, axFalse);

      var AXUint = this.preparePrimitiveClass("AXUint", "uint", asCoerceUint, 0, asCoerceUint,
                                              axIsTypeUint, axFalse);

      // Install class loaders on the security domain.
      AS.installClassLoaders(this.application, this);
      AS.installNativeFunctions(this);
    }
  }

  /**
   * All code lives within an application domain.
   */
  export class ApplicationDomain {
    /**
     * All application domains have a reference to the root, or system application domain.
     */
    public system: ApplicationDomain;

    /**
     * Parent application domain.
     */
    public parent: ApplicationDomain;

    public securityDomain: SecurityDomain;

    private _abcs: ABCFile [];

    constructor(securityDomain: SecurityDomain, parent: ApplicationDomain) {
      this.securityDomain = securityDomain;
      this.parent = parent;
      this.system = parent ? parent.system : this;
      this._abcs = [];
    }

    public loadABC(abc: ABCFile) {
      assert (this._abcs.indexOf(abc) < 0);
      this._abcs.push(abc);
      abc.setApplicationDomain(this);
    }

    public loadAndExecuteABC(abc: ABCFile) {
      this.loadABC(abc);
      this.executeABC(abc);
    }

    public executeABC(abc: ABCFile) {
      var lastScript = abc.scripts[abc.scripts.length - 1];
      this.executeScript(lastScript);
    }

    public findClassInfo(name: string) {
      for (var i = 0; i < this._abcs.length; i++) {
        var abc = this._abcs[i];
        for (var j = 0; j < abc.instances.length; j++) {
          var c = abc.classes[j];
          if (c.instanceInfo.getName().name === name) {
            return c;
          }
        }
      }
      return null;
    }

    public executeScript(scriptInfo: ScriptInfo) {
      assert (scriptInfo.state === ScriptInfoState.None);

      runtimeWriter && runtimeWriter.writeLn("Running Script: " + scriptInfo);
      var global = this.securityDomain.createAXGlobal(this, scriptInfo);
      scriptInfo.global = global;
      scriptInfo.state = ScriptInfoState.Executing;
      interpret(<any>global, scriptInfo.getInitializer(), global.scope, []);
      scriptInfo.state = ScriptInfoState.Executed;
    }

    public findProperty(mn: Multiname, strict: boolean, execute: boolean): AXGlobal {
      release || assert(mn instanceof Multiname);
      var script = this.findDefiningScript(mn, execute);
      if (script) {
        return script.global;
      }
      return null;
    }

    public getClass(mn: Multiname): AXClass {
      release || assert(mn instanceof Multiname);
      return <any>this.getProperty(mn, true, true);
    }

    public getProperty(mn: Multiname, strict: boolean, execute: boolean): AXObject {
      release || assert(mn instanceof Multiname);
      var global: any = this.findProperty(mn, strict, execute);
      if (global) {
        return global.axGetProperty(mn);
      }
      return null;
    }

    public findDefiningScript(mn: Multiname, execute: boolean): ScriptInfo {
      release || assert(mn instanceof Multiname);
      // Look in parent domain first.
      var script: ScriptInfo;
      if (this.parent) {
        script = this.parent.findDefiningScript(mn, execute);
        if (script) {
          return script;
        }
      }

      // Search through the loaded abcs.
      for (var i = 0; i < this._abcs.length; i++) {
        var abc = this._abcs[i];
        script = this._findDefiningScriptInABC(abc, mn, execute);
        if (script) {
          return script;
        }
      }

      // Still no luck, so let's ask the security domain to load additional ABCs and try again.
      var abc = this.system.securityDomain.findDefiningABC(mn);
      if (abc) {
        this.loadABC(abc);
        script = this._findDefiningScriptInABC(abc, mn, execute);
        release || assert(script, 'Shall find class in loaded ABC');
        return script;
      }

      return null;
    }

    private _findDefiningScriptInABC(abc: ABCFile, mn: Multiname, execute: boolean): ScriptInfo {
      var scripts = abc.scripts;
      for (var j = 0; j < scripts.length; j++) {
        var script = scripts[j];
        var traits = script.traits;
        traits.resolve();
        if (traits.getTrait(mn)) {
          // Ensure script is executed.
          if (execute && script.state === ScriptInfoState.None) {
            this.executeScript(script);
          }
          return script;
        }
      }
      return null;
    }
  }
}
