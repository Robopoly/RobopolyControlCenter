"use strict";

function Serial()
{
	this.port = false;
	this.connectionId = -1;
	this.listeners = [];
}

Serial.prototype.connect = function(port, options)
{
	if(!port)
	{
		return false;
	}

	this.port = port;

	// Options are optional, but must be defined
	options = typeof options !== "undefined" ? options : {};

	var self = this;

	// Try to connect and set callback
	chrome.serial.connect(this.port, options, function(ConnectionInfo)
	{
		self.connectionId = ConnectionInfo.connectionId;

		// Connection was unsuccessful
		if(self.connectionId == -1)
		{
			return;
		}
	});
	
	return true;
}

Serial.prototype.disconnect = function()
{
	if(this.connectionId < 1)
	{
		return;
	}

	// Reset in case motors are currently moving
	this.send("r");

	// Do not remove listeners here yet as one can reconnect to the device
	var self = this;
	chrome.serial.disconnect(this.connectionId, function(result)
	{
		self.connectionId = -1;
	});
}

Serial.prototype.send = function(data, options)
{
	if(this.connectionId < 1)
	{
		return;
	}

	// Add optional bytes to the end of the data
	if(typeof options !== "undefined")
	{
		options.forEach(function(option)
		{
			// Mask for one byte
			data += String.fromCharCode(option & 0xff);
		});
	}

	chrome.serial.send(this.connectionId, this.convertStringToArrayBuffer(data), function(sendInfo)
	{
		//console.log("Sent bytes: " + sendInfo.bytesSent);
	});
}

Serial.prototype.addListener = function(function_reference)
{
	// Add a listener to the list and return the ID (length of the array - 1)
	chrome.serial.onReceive.addListener(function_reference);
	this.listeners.push(function_reference);
}

Serial.prototype.removeListener = function(function_reference)
{
	// Remove the listener from the list
	chrome.serial.onReceive.removeListener(function_reference);
}

Serial.prototype.purgeListeners = function()
{
	// Remove all listeners
	var self = this;
	this.listeners.forEach(function(listener)
	{
		self.removeListener(listener);
	});

	this.listeners = [];
}

// From: https://developer.chrome.com/apps/app_serial
Serial.prototype.convertStringToArrayBuffer = function(str)
{
	var buf = new ArrayBuffer(str.length);
	var bufView = new Uint8Array(buf);
	for(var i = 0; i < str.length; i++)
	{
		bufView[i] = str.charCodeAt(i);
	}
	return buf;
}

Serial.prototype.parseData = function(data)
{
	var type = data.shift();
	switch(type)
	{
		case "v":
			data = data.split("=");
			return {'pin': parseInt(data[0]), 'value': parseInt(data[1])};
	}

	return -1;
}

function buildPortPicker(ports)
{
	var eligiblePorts = ports.filter(function(port)
	{
		return port.path.match(/\/dev\/tty/) || port.path.match(/COM/);
	});

	var portPicker = $("#port");

	eligiblePorts.forEach(function(port)
	{
		var portOption = $("<option></option>");
		portOption.val(port.path);
		portOption.html(port.path);
		portPicker.append(portOption);
	});

	// Try to restore settings selected before
	chrome.storage.local.get("port", function(result)
	{
		// If the value exists but the device is not connected the dropdown will be blank, which is a good thing
		if(result.port)
		{
			$("#port").val(result.port);
		}
	});

	// 
	chrome.storage.local.get("bitrate", function(result)
	{
		if(result.bitrate)
		{
			$("#bitrate").val(result.bitrate);
		}
	});
}
