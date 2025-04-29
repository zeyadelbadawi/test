/******************* ENERGY SAVER CONFIG *******************/
let CONFIG = {
    // When set to true, debug messages will be logged to the console
    debug: true,
  
    // When set to true the scan will be active, otherwise it will be passive. 
    active: true,
  
    // Period of inactivity (in minutes) before turning off the relay
  inactivityTimeout: 1,  // 5 minutesToMs()
    // Motion sensors to monitor (add your sensors here)
    motionSensors: {
      // عنوان MAC لكل حساس حركة ووصف له
      "f4:b3:b1:fa:c4:c3": { name: "حساس 1", lastActivity: 0 },
      "7c:c6:b6:03:a0:2a": { name: "حساس 2", lastActivity: 0 },
      "99:88:99:88:99:88": { name: "حساس 3", lastActivity: 0 },
      // أضف المزيد من الحساسات حسب الحاجة
    },
    
    // عنوان MAC لحساس الباب
    doorSensor: "0c:ef:f6:e4:fb:f6",
    
    // كم عدد الحساسات التي يلزم وجودها نشطة لإبقاء الريليه في وضع التشغيل
    // إذا كان عدد الحساس��ت النشطة أقل من هذا الرقم، سيتم إيقاف الريليه
    // ضع 1 إذا كنت تريد إيقاف الريليه عندما تكون جميع الحساسات غير نشطة
    minActiveSensors: 1,
  };
  /******************* END CONFIG *******************/
  
  // Constants for BTHome device identification and data parsing
  const BTHOME_SVC_ID_STR = "fcd2";
  const uint8 = 0;
  const int8 = 1;
  const uint16 = 2;
  const int16 = 3;
  const uint24 = 4;
  const int24 = 5;
  
  // The BTH object defines the structure of the BTHome data
  const BTH = {
    0x00: { n: "pid", t: uint8 },
    0x01: { n: "battery", t: uint8, u: "%" },
    0x02: { n: "temperature", t: int16, f: 0.01, u: "tC" },
    0x03: { n: "humidity", t: uint16, f: 0.01, u: "%" },
    0x05: { n: "illuminance", t: uint24, f: 0.01 },
    0x21: { n: "motion", t: uint8 },  // هذا هو بيان الحركة الفعلي
    0x2d: { n: "window", t: uint8 },
    0x2e: { n: "humidity", t: uint8, u: "%" },
    0x3a: { n: "button", t: uint8 },
    0x3f: { n: "rotation", t: int16, f: 0.1 },
    0x45: { n: "temperature", t: int16, f: 0.1, u: "tC" },
  };
  
  // Global variables
  let timeoutTimer = null;   // مؤقت للفحص الدوري
  let isRelayOn = true;      // حالة الريليه الحالية
  let doorOpened = false;    // حالة الباب (هل تم فتحه)
  let lastDoorState = false; // حالة الباب الأخيرة
  let lastPacketId = 0x100;  // لتفادي تكرار معالجة نفس الحزمة البيانية
  let doorEventTime = 0;     // وقت آخر حدث للباب (فتح أو إغلاق)
  let countdownStarted = false; // هل بدأ العد التنازلي؟
  let motionDetectedSinceLastDoorEvent = false; // هل تم اكتشاف حركة منذ آخر حدث للباب؟
  let activeTimers = []; // قائمة المؤقتات النشطة للتمكن من إلغائها
  
  function getTimeString() {
    let now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    let seconds = now.getSeconds();
  
    hours = hours < 10 ? "0" + hours : hours;
    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;
  
    return hours + ":" + minutes + ":" + seconds;
  }
  
  function debugLog(message) {
    if (CONFIG.debug) {
      print("[" + getTimeString() + "] " + message);
    }
  }
  
  // تحويل دقائق إلى ميلي ثانية
  function minutesToMs(minutes) {
    return minutes * 60 * 1000;
  }
  
  // الحصول على الوقت الحالي بالميلي ثانية
  function getCurrentTimeMs() {
    return Date.now();
  }
  
  // التحقق من نشاط الحساسات منذ آخر حدث باب
  function checkMotionSinceDoorEvent() {
    if (!countdownStarted) {
      return; // لم يبدأ العد التنازلي بعد
    }
  
    // إذا تم اكتشاف حركة منذ آخر حدث باب، لا نفعل شيئًا
  if (motionDetectedSinceLastDoorEvent) {
    debugLog("✅ تم اكتشاف حركة منذ آخر حدث باب، لا يلزم إيقاف الريليه");
    
    // إعادة ضبط العلامات لدورة جديدة
    countdownStarted = false;
    motionDetectedSinceLastDoorEvent = false;
    
    // مسح أي مؤقتات نشطة
    while (activeTimers.length > 0) {
      let timerID = activeTimers.pop();
      Timer.clear(timerID);
    }
    
    return;
  }
  
    // التحقق من الوقت المنقضي منذ آخر حدث باب
    let currentTime = getCurrentTimeMs();
    let timeElapsed = currentTime - doorEventTime;
    let inactivityThreshold = minutesToMs(CONFIG.inactivityTimeout);
  
    if (timeElapsed >= inactivityThreshold && isRelayOn) {
      debugLog("⏰ انقضت مدة " + CONFIG.inactivityTimeout + " دقيقة منذ آخر حدث باب ولم يتم اكتشاف أي حركة");
      turnOffRelay();
      // إعادة ضبط العلامات لدورة جديدة
      countdownStarted = false;
      motionDetectedSinceLastDoorEvent = false;
    } else if (isRelayOn) {
      let minutesRemaining = Math.round((inactivityThreshold - timeElapsed) / 60000);
      debugLog("⏳ متبقي " + minutesRemaining + " دقيقة قبل إيقاف الريليه (بدون حركة)");
    }
  }
  
  // تحديث وقت آخر نشاط لحساس معين عند اكتشاف حركة فعلية
  function updateSensorActivity(macAddress) {
    if (CONFIG.motionSensors[macAddress]) {
      CONFIG.motionSensors[macAddress].lastActivity = getCurrentTimeMs();
      debugLog("🔄 تم اكتشاف حركة فعلية من حساس " + CONFIG.motionSensors[macAddress].name + 
              " وتم تحديث وقت النشاط في " + getTimeString());
      
      // تحديث علامة اكتشاف الحركة منذ آخر حدث باب
      if (countdownStarted) {
        motionDetectedSinceLastDoorEvent = true;
        debugLog("✅ تم تسجيل حركة بعد آخر حدث باب، سيتم إلغاء العد التنازلي");
    
        // مسح أي مؤقتات نشطة
        while (activeTimers.length > 0) {
          let timerID = activeTimers.pop();
          Timer.clear(timerID);
        }
      }
    }
  }
  
  // تشغيل الريليه
  function turnOnRelay() {
    Shelly.call("Switch.Set", { id: 0, on: true });
    isRelayOn = true;
    debugLog("✅ تم تشغيل الريليه");
  }
  
  // إيقاف الريليه
  function turnOffRelay() {
    Shelly.call("Switch.Set", { id: 0, on: false });
    isRelayOn = false;
    debugLog("❌ تم إيقاف تشغيل الريليه بسبب عدم وجود حركة لمدة " + 
            CONFIG.inactivityTimeout + " دقيقة بعد فتح/إغلاق الباب");
  }
  

  // handle door event logic
  function handleDoorEvent(isOpen) {
    if (isOpen !== lastDoorState) {
      lastDoorState = isOpen;
      doorEventTime = getCurrentTimeMs();
  
      if (isOpen) {
        doorOpened = true;
        debugLog("🚪 تم فتح الباب");
      } else {
        doorOpened = false;
        debugLog("🚪 تم إغلاق الباب");
  
        // Reset all logic like first time
        debugLog("🔄 إعادة تهيئة النظام بالكامل كما في المرة الأولى");
  
        // Reset flags to handle all logic from scratch
        countdownStarted = false; 
        motionDetectedSinceLastDoorEvent = false;
  
        // Clear previous timers and set new ones
        while (activeTimers.length > 0) {
          let timerID = activeTimers.pop();
          Timer.clear(timerID);
        }
  
        // Reinitialize sensor activity and motion detection logic
        for (let macAddress in CONFIG.motionSensors) {
          CONFIG.motionSensors[macAddress].lastActivity = 0;
        }
  
        // Start the countdown logic like the first time
        countdownStarted = true;
        debugLog("⏱ بدء العد التنازلي بعد إغلاق الباب");
  
        // Set new timers to check for motion at 30s and 60s intervals
        let timer30s = Timer.set(30000, false, function() {
          checkMotionSinceDoorEvent();
        });
        let timer60s = Timer.set(60000, false, function() {
          checkMotionSinceDoorEvent();
        });
        activeTimers.push(timer30s);
        activeTimers.push(timer60s);
  
        // Add a final check after 1 minute
        Timer.set(60000, false, function() {
          checkMotionSinceDoorEvent();
        });
      }
    }
  }
    
  // Functions for decoding and unpacking the service data from Shelly BLU devices
  function getByteSize(type) {
    if (type === uint8 || type === int8) return 1;
    if (type === uint16 || type === int16) return 2;
    if (type === uint24 || type === int24) return 3;
    return 255;
  }
  
  const BTHomeDecoder = {
    utoi: function (num, bitsz) {
      const mask = 1 << (bitsz - 1);
      return num & mask ? num - (1 << bitsz) : num;
    },
    getUInt8: function (buffer) {
      return buffer.at(0);
    },
    getInt8: function (buffer) {
      return this.utoi(this.getUInt8(buffer), 8);
    },
    getUInt16LE: function (buffer) {
      return 0xffff & ((buffer.at(1) << 8) | buffer.at(0));
    },
    getInt16LE: function (buffer) {
      return this.utoi(this.getUInt16LE(buffer), 16);
    },
    getUInt24LE: function (buffer) {
      return (
        0x00ffffff & ((buffer.at(2) << 16) | (buffer.at(1) << 8) | buffer.at(0))
      );
    },
    getInt24LE: function (buffer) {
      return this.utoi(this.getUInt24LE(buffer), 24);
    },
    getBufValue: function (type, buffer) {
      if (buffer.length < getByteSize(type)) return null;
      let res = null;
      if (type === uint8) res = this.getUInt8(buffer);
      if (type === int8) res = this.getInt8(buffer);
      if (type === uint16) res = this.getUInt16LE(buffer);
      if (type === int16) res = this.getInt16LE(buffer);
      if (type === uint24) res = this.getUInt24LE(buffer);
      if (type === int24) res = this.getInt24LE(buffer);
      return res;
    },
  
    // Unpacks the service data buffer from a Shelly BLU device
    unpack: function (buffer) {
      if (typeof buffer !== "string" || buffer.length === 0) return null;
      let result = {};
      let _dib = buffer.at(0);
      result["encryption"] = _dib & 0x1 ? true : false;
      result["BTHome_version"] = _dib >> 5;
      if (result["BTHome_version"] !== 2) return null;
      if (result["encryption"]) return result;
      buffer = buffer.slice(1);
  
      let _bth;
      let _value;
      while (buffer.length > 0) {
        _bth = BTH[buffer.at(0)];
        if (typeof _bth === "undefined") {
          break;
        }
        buffer = buffer.slice(1);
        _value = this.getBufValue(_bth.t, buffer);
        if (_value === null) break;
        if (typeof _bth.f !== "undefined") _value = _value * _bth.f;
  
        if (typeof result[_bth.n] === "undefined") {
          result[_bth.n] = _value;
        }
        else {
          if (Array.isArray(result[_bth.n])) {
            result[_bth.n].push(_value);
          }
          else {
            result[_bth.n] = [
              result[_bth.n],
              _value
            ];
          }
        }
  
        buffer = buffer.slice(getByteSize(_bth.t));
      }
      return result;
    },
  };
  
  // معالجة أحداث BLE ومراقبة حساسات الحركة والباب
  function processEventData(data) {
    const macAddress = data.address.toLowerCase();
    
    // حساس الباب
    if (macAddress === CONFIG.doorSensor) {
      // إذا كان الباب يرسل حالة window، نستخدمها
      if (typeof data.window !== 'undefined') {
        handleDoorEvent(data.window === 1);
      } 
      // إذا كان الباب يرسل حالة motion، نستخدمها
      else if (typeof data.motion !== 'undefined') {
        handleDoorEvent(data.motion === 1);
      }
      // نستخدم button إذا كان موجودًا
      else if (typeof data.button !== 'undefined') {
        handleDoorEvent(data.button === 1);
      } 
      // لا يوجد بيانات محددة، نستخدم معلومات القاعدة
      else {
        debugLog("ℹ تم اكتشاف حساس الباب ولكن لا توجد معلومات حالة واضحة");
      }
      return;
    }
    
    // حساسات الحركة
    if (typeof CONFIG.motionSensors[macAddress] !== 'undefined') {
      // إذا كان الحساس يرسل بيانات حركة
      if (typeof data.motion !== 'undefined') {
        if (data.motion === 1) {
          debugLog("🔄 تم اكتشاف حركة فعلية من حساس " + CONFIG.motionSensors[macAddress].name);
          updateSensorActivity(macAddress);
        } else {
          debugLog("📡 تم اكتشاف حساس: " + CONFIG.motionSensors[macAddress].name + 
                  " (" + macAddress + ") ب��ون حركة");
        }
      } else {
        debugLog("📡 تم اكتشاف حساس: " + CONFIG.motionSensors[macAddress].name + 
                 " (" + macAddress + ") بدون بيانات حركة");
      }
    }
  }
  
  // Callback for the BLE scanner
  function BLEScanCallback(event, result) {
    if (event !== BLE.Scanner.SCAN_RESULT) {
      return;
    }
  
    // Process Shelly BLU BTHome service data
    if (typeof result.service_data !== 'undefined' && 
        typeof result.service_data[BTHOME_SVC_ID_STR] !== 'undefined') {
      
      let data = BTHomeDecoder.unpack(result.service_data[BTHOME_SVC_ID_STR]);
      
      if (data === null || data.encryption) {
        return;
      }
      
      // Skip duplicate packets
      if (lastPacketId === data.pid) {
        return;
      }
      
      lastPacketId = data.pid;
      
      // Add address and RSSI to data
      data.address = result.addr;
      data.rssi = result.rssi;
      
      // Process the data for our sensors
      processEventData(data);
      return;
    }
    
    // Process regular BLE advertisements
    const macAddress = result.addr.toLowerCase();
    
    // حساس الباب
    if (macAddress === CONFIG.doorSensor) {
      debugLog("📡 حساس الباب: MAC=" + CONFIG.doorSensor + " RSSI=" + result.rssi);
      
      // إذا لم يكن هناك بيانات BTHome، نعتبر أن اكتشاف الإعلان كنشاط
      // تبديل حالة الباب - هذا سيكتشف الفتح والإغلاق
      doorOpened = !doorOpened;
      
      if (doorOpened) {
        debugLog("🚪 تم اكتشاف نشاط في حساس الباب - نعتبره فتح الباب");
        doorEventTime = getCurrentTimeMs();
      } else {
        debugLog("🚪 تم اكتشاف نشاط جديد - نعتبره إغلاق الباب");
        doorEventTime = getCurrentTimeMs();
        
        // بدء العد التنازلي عند إغلاق الباب
        countdownStarted = true;
        motionDetectedSinceLastDoorEvent = false;
        debugLog("⏱ بدء العد التنازلي: " + CONFIG.inactivityTimeout + " دقيقة لإيقاف الريليه إذا لم يتم اكتشاف حركة");
        
  // مسح أي مؤقتات سابقة أولاً
  while (activeTimers.length > 0) {
    let timerID = activeTimers.pop();
    Timer.clear(timerID);
    debugLog("تم مسح مؤقت سابق");
  }
  
  // إضافة مؤقتات جديدة
  let timer30s = Timer.set(30000, false, function() {
    debugLog("تنفيذ فحص بعد 30 ثانية من إغلاق الباب");
    checkMotionSinceDoorEvent();
  });
  
  let timer60s = Timer.set(60000, false, function() {
    debugLog("تنفيذ فحص بعد 60 ثانية من إغلاق الباب");
    checkMotionSinceDoorEvent();
  });
  
  activeTimers.push(timer30s);
  activeTimers.push(timer60s);
        
        // إضافة فحص فوري بعد 30 ثانية ثم مرة أخرى بعد دقيقة كاملة
  
  
  Timer.set(60000, false, function() {
    checkMotionSinceDoorEvent();
  });
      }
      return;
    }
  }
  
  // الفحص الدوري للحساسات والعد التنازلي
  function setupPeriodicCheck() {
    // إلغاء المؤقت الحالي إن وجد
    if (timeoutTimer !== null) {
      Timer.clear(timeoutTimer);
    }
    
    // إنشاء مؤقت للفحص الدوري كل دقيقة
    timeoutTimer = Timer.set(60000, true, function() {
      // في كل دقيقة، نتحقق من نشاط الحركة منذ آخر حدث باب
      checkMotionSinceDoorEvent();
    });
    
    debugLog("⏱ تم إنشاء فحص دوري للحساسات كل دقيقة");
  }
  
  // تهيئة النظام
  function init() {
    debugLog("🚀 بدء تشغيل نظام توفير الطاقة مع دعم حساسات شيلي BTHome");
    
    // تحقق من إعدادات BLE
    let BLEConfig = Shelly.getComponentConfig("ble");
    
    if (!BLEConfig.enable) {
      debugLog("❌ البلوتوث غير مفعل. ير��ى تفعيله من الإعدادات");
      return;
    }
    
    // بدء مسح BLE إذا لم يكن قيد التشغيل بالفعل
    if (!BLE.Scanner.isRunning()) {
      BLE.Scanner.Start({
        duration_ms: BLE.Scanner.INFINITE_SCAN,
        active: CONFIG.active
      });
      debugLog("✅ تم بدء تشغيل ماسح BLE");
    } else {
      debugLog("ℹ ماسح BLE قيد التشغيل بالفعل");
    }
    
    // إعداد الفحص الدوري
    setupPeriodicCheck();
    
    // الاشتراك في أحداث BLE
    BLE.Scanner.Subscribe(BLEScanCallback);
    
    debugLog("✅ تم تهيئة النظام بنجاح | " + Object.keys(CONFIG.motionSensors).length + 
            " حساسات | مدة عدم النشاط: " + CONFIG.inactivityTimeout + " دقيقة");
  }
  
  // بدء النظام
  init();
