(function(MW){
  'use strict';
  const {Api,Contracts,Storage}=MW;
  const DEFAULT_TTL_MS=300000;

  function keyText(value){
    return String(value==null?'':value).trim().toLowerCase()
      .replace(/[\u064B-\u065F\u0670\u0640]/g,'')
      .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ة/g,'ه')
      .replace(/[^\u0621-\u063A\u0641-\u064A0-9a-z]+/g,' ')
      .replace(/\s+/g,' ').trim();
  }
  function adminKey(value){
    let s=keyText(value);if(!s)return '';
    const full=/^(?:ال)?اداره الصحيه\s+/.test(s);
    s=s.replace(/^(?:ال)?اداره(?: الصحيه)?\s+/,'');
    if(full&&s.startsWith('ب'))s=s.slice(1);
    return s;
  }
  function treatmentName(value){
    const k=keyText(value);
    if(['محرقة شبراهور هوفال','محرقة شبراهور المعصرة'].some(x=>keyText(x)===k))return 'محرقتا شبراهور';
    if(keyText('محرقة ميت غمر')===k)return 'محرقة أجا';
    return String(value||'').trim();
  }
  function dedupe(list,keyFn,transform){
    const out=[],seen=new Map();
    (Array.isArray(list)?list:[]).forEach(raw=>{
      const item=transform?transform(Object.assign({},raw)):raw;
      const key=keyFn(item);if(!key)return;
      if(!seen.has(key)){seen.set(key,out.length);out.push(item);return;}
      const at=seen.get(key),existing=out[at];
      if(item?.active===true&&existing?.active!==true)out[at]=item;
      if(item?.entityType===Contracts.EntityTypes.HEALTH_ADMIN&&/الصحي/.test(String(item.name||''))&&!/الصحي/.test(String(existing?.name||'')))out[at]=item;
    });
    return out;
  }
  function normalizeDirectory(data){
    data=data&&typeof data==='object'?data:{};
    const healthAdmins=dedupe(data.healthAdmins,x=>adminKey(x?.name||x?.healthAdmin||''),x=>x);
    const facilities=dedupe(data.facilities,x=>{
      const admin=x?.mainType==='إدارات صحية'?adminKey(x?.healthAdmin||''):'';
      return [keyText(x?.mainType),admin,keyText(x?.name)].join('|');
    },x=>x);
    const treatmentUnits=dedupe(data.treatmentUnits,x=>keyText(treatmentName(x?.name)),x=>{x.name=treatmentName(x.name);return x;});
    const directorates=dedupe(data.directorates,x=>keyText(x?.name),x=>x);
    const primitive=(arr)=>{const out=[],seen=new Set();(Array.isArray(arr)?arr:[]).forEach(v=>{const k=keyText(v);if(k&&!seen.has(k)){seen.add(k);out.push(v);}});return out;};
    return{facilities,healthAdmins,treatmentUnits,directorates,cars:primitive(data.cars),drivers:primitive(data.drivers)};
  }

  function cached(){const data=Storage.getJson(Storage.KEYS.entitiesDirectory,null);return data&&typeof data==='object'?normalizeDirectory(data):null;}
  function isFresh(maxAgeMs=DEFAULT_TTL_MS){const at=Number(Storage.getText(Storage.KEYS.entitiesFetchedAt,'0'))||0;return !!cached()&&at>0&&(Date.now()-at)<Math.max(0,Number(maxAgeMs)||0);}
  function saveCache(data){const normalized=normalizeDirectory(data);Storage.setJson(Storage.KEYS.entitiesDirectory,normalized);Storage.setText(Storage.KEYS.entitiesFetchedAt,Date.now());return normalized;}
  function invalidate(){Storage.remove(Storage.KEYS.entitiesDirectory);Storage.remove(Storage.KEYS.entitiesFetchedAt);}
  function registrationFromCache(){const c=Storage.getJson(Storage.KEYS.registrationOptions,null);return c&&typeof c==='object'?normalizeDirectory(c):null;}
  function registrationIsFresh(maxAgeMs=21600000){const at=Number(Storage.getText(Storage.KEYS.registrationOptionsFetchedAt,'0'))||0;return !!registrationFromCache()&&at>0&&(Date.now()-at)<maxAgeMs;}
  function saveRegistrationCache(data){const normalized=normalizeDirectory(data);Storage.setJson(Storage.KEYS.registrationOptions,normalized);Storage.setText(Storage.KEYS.registrationOptionsFetchedAt,Date.now());return normalized;}
  async function registrationOptions(options={}){const maxAgeMs=Number(options.maxAgeMs)||21600000,local=registrationFromCache();if(!options.force&&local&&registrationIsFresh(maxAgeMs)&&(local.facilities?.length||local.healthAdmins?.length||local.directorates?.length))return local;try{const r=await Api.post(Contracts.Actions.GET_REGISTRATION_OPTIONS);return saveRegistrationCache(r.data||{});}catch(error){if(local)return local;throw error;}}
  async function list(options={}){const maxAgeMs=options.force?0:(Number(options.maxAgeMs)||DEFAULT_TTL_MS);if(!options.force&&isFresh(maxAgeMs))return cached();try{const r=await Api.read(Contracts.Actions.GET_ENTITIES);return saveCache(r.data||{});}catch(error){const local=cached();if(local)return local;throw error;}}
  function prime(data){return saveCache(data||{});}
  MW.EntitiesRepository=Object.freeze({registrationOptions,registrationFromCache,list,cached,isFresh,invalidate,prime,normalizeDirectory,adminKey,keyText});
})(window.MedWaste);
