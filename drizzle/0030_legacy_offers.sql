INSERT INTO offer_campaigns (legacyTemplateId,artistId,rulesJson,archived,createdAt)
SELECT t.id,t.artistId,JSON_OBJECT(
'name',LEFT(IF(CHAR_LENGTH(t.name)<2,CONCAT(t.name,' offer'),t.name),80),
'description',LEFT(COALESCE(t.description,''),500),
'kind',IF(t.type='discount','discount','voucher'),
'valueType',IF(t.type='discount',t.valueType,'fixed'),
'value',LEAST(10000000,GREATEST(1,IF(t.valueType='percentage' AND t.type='discount',LEAST(t.value,100),t.value))),
'currency','AUD','eligibility','unpaid','expiresAt',NULL,'sittingFrom',NULL,'sittingUntil',NULL,
'backgroundImageUrl',IF(t.backgroundImageUrl LIKE 'https://%',t.backgroundImageUrl,''),
'funding','gift'),IF(t.isActive=1,0,1),COALESCE(t.createdAt,UTC_TIMESTAMP())
FROM promotion_templates t
ON DUPLICATE KEY UPDATE legacyTemplateId=VALUES(legacyTemplateId);
--> statement-breakpoint
INSERT INTO client_offers (campaignId,artistId,clientId,originalClientId,rulesJson,remainingValue,issuedAt,issuanceKey)
SELECT c.id,p.artistId,p.clientId,p.clientId,JSON_SET(c.rulesJson,
'$.kind',IF(p.type='discount','discount','voucher'),
'$.valueType',IF(p.type='discount',p.valueType,'fixed'),
'$.value',LEAST(10000000,GREATEST(1,IF(p.valueType='percentage' AND p.type='discount',LEAST(p.originalValue,100),p.originalValue))),
'$.expiresAt',IF(p.expiresAt IS NULL,NULL,DATE_FORMAT(p.expiresAt,'%Y-%m-%dT%H:%i:%s.000Z'))),
p.remainingValue,COALESCE(p.createdAt,UTC_TIMESTAMP()),CONCAT('legacy:',p.id)
FROM issued_promotions p JOIN offer_campaigns c ON c.legacyTemplateId=p.templateId
WHERE p.clientId IS NOT NULL AND p.status IN ('active','partially_used') AND p.remainingValue>0
ON DUPLICATE KEY UPDATE issuanceKey=VALUES(issuanceKey);
