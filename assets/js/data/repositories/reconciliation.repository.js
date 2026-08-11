(function(MW){'use strict';
const {Api,Contracts}=MW;
async function compare(filters){const r=await Api.read(Contracts.Actions.GET_RECONCILIATION,filters);return r.data||{summary:{},days:[]};}
async function compareHealthAdmin(filters){const payload=Object.assign({},filters,{entityType:Contracts.EntityTypes.HEALTH_ADMIN,scopeType:Contracts.EntityTypes.HEALTH_ADMIN,adminScope:'admin',compareMode:'health_admin',facilityMainType:'إدارات صحية',mainType:'إدارات صحية'});const r=await Api.read(Contracts.Actions.GET_RECONCILIATION,payload);return r.data||{summary:{},days:[]};}
async function authorizeClaim(scope){return Api.post(Contracts.Actions.AUTHORIZE_CLAIM,scope);}
MW.ReconciliationRepository=Object.freeze({compare,compareHealthAdmin,authorizeClaim});
})(window.MedWaste);
