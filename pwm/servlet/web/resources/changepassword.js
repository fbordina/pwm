/*
 * Password Management Servlets (PWM)
 * http://code.google.com/p/pwm/
 *
 * Copyright (c) 2006-2009 Novell, Inc.
 * Copyright (c) 2009-2010 The PWM Project
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 */

//
// PWM Change Password JavaScript.
//

var passwordsMasked = true;
var previousP1 = "";

var COLOR_BAR_TOP       = 0x8ced3f;
var COLOR_BAR_BOTTOM    = 0xcc0e3e;

var validationCache = { };
var validationInProgress = false;

var remainingFetches = 0;

// takes password values in the password fields, sends an http request to the servlet
// and then parses (and displays) the response from the servlet.
function validatePasswords()
{
    if (getObject("password1").value.length <= 0 && getObject("password2").value.length <= 0) {
        updateDisplay(null);
        return;
    }

    if (previousP1 != getObject("password1").value) {  // if p1 is changing, then clear out p2.
        getObject("password2").value = "";
        previousP1 = getObject("password1").value;
    }

    var passwordData = makeValidationKey();
    {
        var cachedResult = validationCache[passwordData.cacheKey];
        if (cachedResult != null) {
            updateDisplay(cachedResult);
            return;
        }
    }

    setTimeout(function(){
        if (validationInProgress) {
            showWorking();
            //validatePasswords();
        }
    },200);
    validationInProgress = true;
    dojo.xhrPost({
        url: PWM_STRINGS['url-changepassword'] + "?processAction=validate&pwmFormID=" + getObject('pwmFormID').value,
        postData: dojo.toJson(passwordData),
        contentType: "application/json;charset=utf-8",
        dataType: "json",
        handleAs: "json",
        error: function(errorObj) {
            validationInProgress = false;
            clearError(PWM_STRINGS['Display_CommunicationError']);
            markStrength(0);
            console.log('error: ' + errorObj);
        },
        load: function(data){
            validationInProgress = false;
            updateDisplay(data);
            validationCache[passwordData.cacheKey] = data;
            if (passwordData.cacheKey != makeValidationKey().cacheKey) {
                setTimeout(function() {validatePasswords();}, 1);
            }
        }
    });
}

function makeValidationKey() {
    var validationKey = {
        password1:getObject("password1").value,
        password2:getObject("password2").value,
        cacheKey: getObject("password1").value + getObject("password2").value
    };

    if (getObject("currentPassword") != null) {
        validationKey.currentPassword = getObject("currentPassword").value;
        validationKey.cacheKey = getObject("password1").value + getObject("password2").value + getObject("currentPassword").value;
    }

    return validationKey;
}

function updateDisplay(resultInfo) {
    if (resultInfo == null) {
        clearError('\u00A0');
        markStrength(0);
        return;
    }

    var message = resultInfo["message"];

    if (resultInfo["version"] != "2") {
        showError("[ unexpected version string from server ]");
        return;
    }

    if (resultInfo["passed"] == "true") {
        if (resultInfo["match"] == "MATCH") {
            showSuccess(message);
        } else {
            showConfirm(message);
        }
    } else {
        showError(message);
    }

    markConfirmationCheck(resultInfo["match"]);
    markStrength(resultInfo["strength"]);
}

function markConfirmationCheck(matchStatus) {
    if (matchStatus == "MATCH") {
        getObject("confirmCheckMark").style.visibility = 'visible';
        getObject("confirmCrossMark").style.visibility = 'hidden';
        getObject("confirmCheckMark").width = '15';
        getObject("confirmCrossMark").width = '0';
    } else if (matchStatus == "NO_MATCH") {
        getObject("confirmCheckMark").style.visibility = 'hidden';
        getObject("confirmCrossMark").style.visibility = 'visible';
        getObject("confirmCheckMark").width = '0';
        getObject("confirmCrossMark").width = '15';
    } else {
        getObject("confirmCheckMark").style.visibility = 'hidden';
        getObject("confirmCrossMark").style.visibility = 'hidden';
        getObject("confirmCheckMark").width = '0';
        getObject("confirmCrossMark").width = '0';
    }
}

function markStrength(strength) { //strength meter
    if (getObject("password1").value.length > 0) {
        getObject("strengthBox").style.visibility = 'visible';
    } else {
        getObject("strengthBox").style.visibility = 'hidden';
    }

    var strengthLabel = "";
    var barColor = "";

    if (strength > 70) {
        strengthLabel = PWM_STRINGS['Strength_High'];
    } else if (strength > 45) {
        strengthLabel = PWM_STRINGS['Strength_Medium'];
    } else {
        strengthLabel = PWM_STRINGS['Strength_Low'];
    }

    var colorFade = function(h1, h2, p) { return ((h1>>16)+((h2>>16)-(h1>>16))*p)<<16|(h1>>8&0xFF)+((h2>>8&0xFF)-(h1>>8&0xFF))*p<<8|(h1&0xFF)+((h2&0xFF)-(h1&0xFF))*p; }
    var gradColor = colorFade(COLOR_BAR_BOTTOM, COLOR_BAR_TOP, strength / 100).toString(16) + '';


    var barObject = getObject("strengthBar");
    if (barObject != null) {
        barObject.style.width = strength + '%';
        barObject.style.backgroundColor = '#' + gradColor;
    }

    var labelObject = getObject("strengthLabel");
    if (labelObject != null) {
        labelObject.innerHTML = strengthLabel == null ? "" : strengthLabel;
    }
}

function clearError(message)
{
    getObject("password_button").disabled = false;
    getObject("error_msg").firstChild.nodeValue = message;
    dojo.animateProperty({
        node:"error_msg",
        duration: 500,
        properties: { backgroundColor:'#FFFFFF' }
    }).play();
}

function showWorking()
{
    getObject("password_button").disabled = true;
    getObject("error_msg").firstChild.nodeValue = PWM_STRINGS['Display_CheckingPassword'];
    dojo.animateProperty({
        node:"error_msg",
        duration: 500,
        properties: { backgroundColor:'#FFCD59' }
    }).play();
}

function showError(errorMsg)
{
    getObject("password_button").disabled = true;
    getObject("error_msg").firstChild.nodeValue = errorMsg;
    dojo.animateProperty({
        node:"error_msg",
        duration: 500,
        properties: { backgroundColor:'#FFCD59' }
    }).play();
}

function showConfirm(successMsg)
{
    getObject("password_button").disabled = true;
    getObject("error_msg").firstChild.nodeValue = successMsg;
    dojo.animateProperty({
        node:"error_msg",
        duration: 500,
        properties: { backgroundColor:'#DDDDDD' }
    }).play();
}

function showSuccess(successMsg)
{
    getObject("password_button").disabled = false;
    getObject("error_msg").firstChild.nodeValue = successMsg;
    dojo.animateProperty({
        node:"error_msg",
        duration: 500,
        properties: { backgroundColor:'#EFEFEF' }
    }).play();
}

function copyToPasswordFields(elementID)  // used to copy auto-generated passwords to password field
{
    var text = getObject(elementID).firstChild.nodeValue;

    if (text.length > 255) {
        text = text.substring(0,255);
    }
    text = trimString(text);


    closeRandomPasswordsDialog();

    if (passwordsMasked) {
        toggleMaskPasswords();
    }

    getObject("password1").value = text;
    validatePasswords();
    getObject("password2").focus();
}

function showRandomPasswordsDialog(dialogBody) {
    dojo.require("dijit.Dialog");
    closeRandomPasswordsDialog();

    var theDialog = new dijit.Dialog({
        title: PWM_STRINGS['Title_RandomPasswords'],
        style: "width: 300px; border: 2px solid #D4D4D4;",
        content: dialogBody,
        closable: false,
        draggable: true,
        id: "randomPasswordDialog"

    });
    theDialog.setAttribute('class','tundra');
    theDialog.show();
}

function closeRandomPasswordsDialog() {
    var dialog = dijit.byId('randomPasswordDialog');
    if (dialog != null) {
        dialog.hide();
        dialog.destroyRecursive();
    }
}

function toggleMaskPasswords()
{
    if (passwordsMasked) {
        getObject("hide_button").value = "\u00A0\u00A0\u00A0" + PWM_STRINGS['Button_Hide'] + "\u00A0\u00A0\u00A0";
        changeInputTypeField(getObject("password1"),"text");
        changeInputTypeField(getObject("password2"),"text");
    } else {
        getObject("hide_button").value = "\u00A0\u00A0\u00A0" + PWM_STRINGS['Button_Show'] + "\u00A0\u00A0\u00A0";
        changeInputTypeField(getObject("password1"),"password");
        changeInputTypeField(getObject("password2"),"password");
    }
    passwordsMasked = !passwordsMasked;

}

function handleChangePasswordSubmit()
{
    getObject("error_msg").firstChild.nodeValue = PWM_STRINGS['Display_PleaseWait'];
    getObject("error_msg").className = "notice";
    PWM_GLOBAL['dirtyPageLeaveFlag'] = false;
}

function doRandomGeneration() {
    var dialogBody = PWM_STRINGS['Display_PasswordGeneration'] + "<br/><br/>";
    dialogBody += '<table style="border: 0">';
    for (var i = 0; i < 20; i++) {
        dialogBody += '<tr style="border: 0"><td style="border: 0; padding-bottom: 5px;" width="20%"><a style="text-decoration:none" href="#" onclick="copyToPasswordFields(\'randomGen' + i + '\')" id="randomGen' + i + '">&nbsp;</a></td>';
        i++;
        dialogBody += '<td style="border: 0; padding-bottom: 5px;" width="20%"><a style="text-decoration:none" href="#" onclick="copyToPasswordFields(\'randomGen' + i + '\')" id="randomGen' + i + '">&nbsp;</a></td></tr>';
    }
    dialogBody += "</table><br/><br/>";

    dialogBody += '<table style="border: 0">';
    dialogBody += '<tr style="border: 0"><td style="border: 0"><button id="moreRandomsButton" disabled="true" onclick="fetchRandoms()">' + PWM_STRINGS['Button_More'] + '</button></td>';
    dialogBody += '<td style="border: 0; text-align:right;"><button onclick="closeRandomPasswordsDialog()">' + PWM_STRINGS['Button_Cancel'] + '</button></td></tr>';
    dialogBody += "</table>";
    showRandomPasswordsDialog(dialogBody);
    fetchRandoms();
}

function fetchRandoms() {
    getObject('moreRandomsButton').disabled = true;
    remainingFetches = 20;
    var fetchList = new Array();
    for (var counter = 0; counter < 20; counter++) {
        fetchList[counter] = 'randomGen' + counter;
    }
    fetchList.sort(function() {return 0.5 - Math.random()});

    for (var item in fetchList) {
        var name = fetchList[item];
        var element = getObject(name);
        if (element != null) {
            element.firstChild.nodeValue = '\u00A0';
        }
        fetchRandom(name);
    }
}

function fetchRandom(elementID)
{
    dojo.xhrGet({
        url: PWM_STRINGS['url-changepassword'] + "?processAction=getrandom&pwmFormID=" + getObject('pwmFormID').value,
        contentType: "application/json;charset=utf-8",
        dataType: "json",
        timeout: 15000,
        sync: false,
        handleAs: "json",
        error: function(errorObj) {
            watchForLastFetch();
        },
        load: function(data){
            handleRandomResponse(data, elementID);
            watchForLastFetch();
        }
    });
}

function watchForLastFetch() {
    remainingFetches--;
    if (remainingFetches == 0) {
        getObject('moreRandomsButton').disabled = false;
        getObject('moreRandomsButton').focus();
    }
}

function handleRandomResponse(resultInfo, elementID)
{
    if (resultInfo["version"] != "1") {
        showError("[ unexpected randomgen version string from server ]");
        return;
    }

    var password = resultInfo["password"];

    var element = getObject(elementID);
    if (element != null) {
        element.firstChild.nodeValue = password;
    }
}

function clearForm() {
    getObject("password1").value = "";
    getObject("password2").value = "";
    if (getObject("currentPassword") != null) getObject("currentPassword").value = "";
    clearError('\u00A0'); //&nbsp;
    markConfirmationCheck("EMPTY");
    markStrength(0);
    setInputFocus();
}

function startupChangePasswordPage()
{
    /* enable the hide button only if the toggle works */
    try {
        toggleMaskPasswords();
        toggleMaskPasswords();
        changeInputTypeField(getObject("hide_button"),"button");
    } catch (e) {
    }

    /* check if browser is ie6 or less. */
    var isIe6orLess = false;
    if (/MSIE (\d+\.\d+);/.test(navigator.userAgent)){ //test for MSIE x.x;
        var ieversion=new Number(RegExp.$1) // capture x.x portion and store as a number
        if (ieversion<=6) {
            isIe6orLess = false;
        }
    }

    // show the auto generate password panel
    var autoGenPasswordElement = getObject("autoGeneratePassword");
    if (autoGenPasswordElement != null) {
        autoGenPasswordElement.style.visibility = 'visible';
    }

    // show the error panel
    var autoGenPasswordElement = getObject("error_msg");
    if (autoGenPasswordElement != null) {
        autoGenPasswordElement.style.visibility = 'visible';
    }

    // add a handler so if the user leaves the page except by submitting the form, then a warning/confirm is shown
    window.onbeforeunload = function() {
        if (PWM_GLOBAL['dirtyPageLeaveFlag']) {
            var message = PWM_STRINGS['Display_LeaveDirtyPasswordPage'];
            return message;
        }
    };

    PWM_GLOBAL['dirtyPageLeaveFlag'] = true;

    setInputFocus();
}

function setInputFocus() {
    var currentPassword = getObject('currentPassword');
    if (currentPassword != null) {
        setTimeout(function() { currentPassword.focus(); },10);
    } else {
        var password1 = getObject('password1');
        setTimeout(function() { password1.focus(); },10);
    }
}