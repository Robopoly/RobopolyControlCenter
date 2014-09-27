"use strict";

var backgroundPage;
chrome.runtime.getBackgroundPage(function(result)
{
	backgroundPage = result;
	backgroundPage.app_window = window;
});

var TABS = {};

function UI_control()
{
	this.serialDevice = null;
	this.activeTabReference = false;
}

var UI = new UI_control();

// Called when the page had loaded
$(document).ready(function()
{
	// Populate the serial devices list
	chrome.serial.getDevices(function(ports)
	{
		buildPortPicker(ports);
	});

	// On clicking on the dropdown refresh the list
	$("#buttonRefresh").click(function()
	{
		$("#port").empty().val("");
		chrome.serial.getDevices(function(ports)
		{
			buildPortPicker(ports);
		});
	})

	// Add listeners to tab links
	$("#tabs a").click(function()
	{
		var name = $(this).parent().prop("class");

		// Run the tab cleanup code
		UI.activeTabReference.cleanup();

		// When a tab switches remove all listeners
		UI.serialDevice.purgeListeners();

		// Reset motors, servomotors and turn all pins to input
		UI.serialDevice.send("r");

		// Remove contents
		$('#content').empty();

		// Remove highlighted style from all tabs
		$("#tabs a").removeClass("active");

		// Highlight the current tab
		$(this).addClass("active");

		TABS[name].initialize(UI.serialDevice);
	});

	// Add listener to the connect button
	$("#buttonConnect").click(function()
	{
		if(UI.serialDevice.connectionId > 0)
		{
			// Already connected, so disconnect
			UI.serialDevice.disconnect();
			$(this).val("Connect");
		}
		else
		{
			// Try to connect to the device
			var port = $("#port").val();
			var bitrate = parseInt($("#bitrate").val());
			
			if(UI.serialDevice.connect(port, {'bitrate': bitrate}))
			{
				$(this).val("Disconnect");	
				// Save the device so it's automatically selected the next time the user uses the application
				chrome.storage.local.set({'port': port, 'bitrate': bitrate});
			}
		}
	});

	// Singleton serial device instance
	UI.serialDevice = new Serial();

	// Load default content of the page
	TABS.home.initialize();
});
