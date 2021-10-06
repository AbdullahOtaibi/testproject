/*
Title : Check Required And Conditional Documents
Purpose : TO Check Required And Conditional Documents
Author: Haetham Eleisah
Functional Area : ACA,AV Events
Description : JSON Example : 

{
  "Marijuana/Retail/Retail Store/Renewal": {
    "ApplicationSpecificInfoUpdateBefore": [
      {
        "preScript": " ",
        "metadata": {
          "description": "required document",
          "operators": {
            
          }
        },
        "criteria": {
          "customLists": [
            {
              "tableName": "t1",
              "columnName": "c1",
              "value": [
                "v1",
                "v2"
              ]
            },
            {
              "tableName": "t2",
              "columnName": "c2",
              "value": [
                "v3",
                "v4"
              ]
            }
          ],
          "contactFields": {
            "contactType": "Applicant"
          },
          "lpFields": {
            "licType": "Engineer",
            
          },
          "customFields": {
            "Job Value": [
              "100",
              "200"
            ],
            "Code": [
              "KBC 2012"
            ]
          },
          "addressFields": {
            "zip": "12345",
            
          },
          "parcelFields": {
            "ParcelNumber": "00800"
          }
        },
        "action": {
          "requiredDocuments": [
            "Photos",
            "Trade Names"
          ],
          "requirementType": "CONDITIONAL",
          "validationMessage": "Please upload required documents: "
        },
        "postScript ": ""
      }
    ]
  }
}

Available Types: contactFields, customFields, customLists, parcelFields, addressFields, lpFields

Available Attributes for each type: 
- Custom Fields and Custom Lists: ALL
- Address: All Custom Attributes, (primaryFlag,houseNumberStart,streetDirection,streetName,streetSuffix,city,state,zip,addressStatus,county,country,addressDescription,xCoordinate,yCoordinate)
- Parcel: All Custom Attributes, (ParcelNumber,Section,Block,LegalDesc,GisSeqNo,SourceSeqNumber,Page,I18NSubdivision,CouncilDistrict,RefAddressTypes,ParcelStatus,ExemptValue,PublicSourceSeqNBR,CensusTract,InspectionDistrict,NoticeConditions,ImprovedValue,PlanArea,Lot,ParcelArea,Township,LandValue)
- Licensed Professional: All Custom Attributes, (licType,lastName,firstName,businessName,address1,city,state,zip,country,email,phone1,phone2,lastRenewalDate,licExpirationDate,FEIN,gender,birthDate)
- Contact: All Custom Attributes, (firstName,lastName,middleName,businessName,contactSeqNumber,contactType,relation,phone1,phone2,email,addressLine1,addressLine2,city,state,zip,fax,notes,country,fullName,peopleModel)
 */

var missingDocObjsArray = new Array();

try {

	var configurableCommonContent = getScriptText("CONFIGURABLE_SCRIPTS_COMMON");
	if (configurableCommonContent && configurableCommonContent != null && configurableCommonContent != "") {
		eval(configurableCommonContent);
	} else {
		eval(getScriptText("CONFIGURABLE_SCRIPTS_COMMON", null, true));
	}

	var settingsArray = [];
	var scriptSuffix = "REQUIRED_DOCUMENTS";
	isConfigurableScript(settingsArray, scriptSuffix);

	for ( var rl in settingsArray) {
		var tmpRules = settingsArray[rl];
		var docValidationObj = {};
		docValidationObj.missingDocs = new Array();//tmpRules.action.requiredDocuments;
		if (isEmptyOrNull(tmpRules.action.validationMessage)) {
			docValidationObj.message = null;//use default message
		} else {
			docValidationObj.message = tmpRules.action.validationMessage;
		}
		missingDocObjsArray.push(docValidationObj);
	}//for all settingsArray

	var requiredDocuments;
	var requirementType;
	var validationMessage;//TODO delete
	for (s in settingsArray) {
		var rules = settingsArray[s];
		var preScript = rules.preScript;
		var postScript = rules.postScript;
		requiredDocuments = rules.action.requiredDocuments;
		requirementType = rules.action.requirementType;
		validationMessage = rules.action.validationMessage;
		/// check if the rules on conditional and the user in AV
		if (requirementType == "CONDITIONAL" && !isPublicUser)
			break;

		// run preScript
		if (!isEmptyOrNull(preScript)) {
			eval(getScriptText(preScript, null, false));
		}
		if (cancelCfgExecution) {
			logDebug("**WARN STDBASE Script [" + scriptSuffix + "] canceled by cancelCfgExecution");
			cancelCfgExecution = false;
			continue;
		}
		// this to clear the required document if the rule was not passed
		if (requirementType == "CONDITIONAL") {
			removeAllRequiredDocumentCapCondition();
		}
		/// this to check if all Rules  if is matched.

		validateDocument(s);

		if (!isEmptyOrNull(postScript)) {
			eval(getScriptText(postScript, null, false));
		}
	}
	displayValidationMessage();

} catch (ex) {
	logDebug("**ERROR: Exception while verifying the rules for " + scriptSuffix + ". Error: " + ex);
}

/// this function will validate documents based on the rules in the JSON.
function validateDocument(rulesIdx) {
	// this when rules is matched;

	var submittedDocArray = null;

	if (!isPublicUser && controlString == "ApplicationSubmitBefore" && capId == null) {
		submittedDocArray = aa.env.getValue("DocumentModelList");
		if (submittedDocArray != null && submittedDocArray != "" && submittedDocArray) {
			submittedDocArray = submittedDocArray.toArray();
		}
	} else {
		submittedDocArray = aa.document.getCapDocumentList(capId, currUserId);
		if (submittedDocArray != null && submittedDocArray.getSuccess()) {
			submittedDocArray = submittedDocArray.getOutput();
		} else {
			submittedDocArray = false;
		}

		if (!submittedDocArray || submittedDocArray == null || submittedDocArray.length == 0) {
			submittedDocArray = aa.document.getDocumentListByEntity(capId, "TMP_CAP");
			if (submittedDocArray != null && submittedDocArray.getSuccess()) {
				submittedDocArray = submittedDocArray.getOutput();
				if (submittedDocArray != null) {
					submittedDocArray = submittedDocArray.toArray();
				}
			}
		}
	}//capId!=null || controlStr not ASB

	var documentExists = false;

	if (requirementType == "CONDITIONAL" && isPublicUser) {
		for ( var d in requiredDocuments) {
			addConditionMultiLanguage(requiredDocuments[d], requiredDocuments[d]);
		}
		documentExists = true;
	} else if (requirementType == "STANDARD") {

		//put submitted docs names in string array (better for search)
		var submittedDocNamesAry = new Array();
		for ( var i in submittedDocArray) {
			submittedDocNamesAry.push(submittedDocArray[i].getDocCategory());
		}

		for ( var d in requiredDocuments) {
			if (!exists(requiredDocuments[d], submittedDocNamesAry)) {
				missingDocObjsArray[rulesIdx].missingDocs.push(requiredDocuments[d]);
			}
		}//for all docs in JSON
	}//STANDARD
}

function displayValidationMessage() {
	var message = "";
	for ( var m in missingDocObjsArray) {
		var tmpMissingDocObj = missingDocObjsArray[m];
		if (tmpMissingDocObj.missingDocs.length == 0) {
			continue;
		}

		if (tmpMissingDocObj.message == null) {
			//"Required Document(s) :<br/>"
			message += "* " + tmpMissingDocObj.missingDocs.join("<br/>* ");
		} else {
			message += "* " + tmpMissingDocObj.message + "<br/>";
		}
	}//for all missingDocObjsArray

	if (message != "") {
		cancel = true;
		showMessage = true;

		message = "Required Documents:<br/>" + message;

		if (isPublicUser) {
			aa.env.setValue("ErrorCode", "1");
			aa.env.setValue("ErrorMessage", message);
			comment(message);
		} else {
			comment(message);
		}
	}
}//displayValidationMessage

function getScriptText(vScriptName, servProvCode, useProductScripts) {
	if (!servProvCode)
		servProvCode = aa.getServiceProviderCode();
	vScriptName = vScriptName.toUpperCase();
	var emseBiz = aa.proxyInvoker.newInstance("com.accela.aa.emse.emse.EMSEBusiness").getOutput();
	try {
		if (useProductScripts) {
			var emseScript = emseBiz.getMasterScript(aa.getServiceProviderCode(), vScriptName);
		} else {
			var emseScript = emseBiz.getScriptByPK(aa.getServiceProviderCode(), vScriptName, "ADMIN");
		}
		return emseScript.getScriptText() + "";
	} catch (err) {
		return "";
	}
}
