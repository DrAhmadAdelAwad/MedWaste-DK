(function(MW){'use strict';
const R=MW.ReconciliationRepository;
async function authorizeFacility(facilityId,startDate,endDate){return R.authorizeClaim({entityType:MW.Contracts.EntityTypes.FACILITY,entityId:facilityId,startDate,endDate});}
async function authorizeHealthAdmin(healthAdmin,startDate,endDate){return R.authorizeClaim({entityType:MW.Contracts.EntityTypes.HEALTH_ADMIN,entityId:healthAdmin,startDate,endDate});}
MW.Claims=Object.freeze({authorizeFacility,authorizeHealthAdmin});
})(window.MedWaste);
