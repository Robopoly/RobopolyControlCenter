"use strict";

TABS.obstacle_avoidance = {};
TABS.obstacle_avoidance.initialize = function(serialDevice)
{
	this.serialDevice = serialDevice;
	this.nextUpdate = false;
	this.data = [];
	this.buffer = "";
	this.avoiding = false;
	this.delay = 100;

	// Pseudo-enum for control architectures
	this.controlArchitectures = {
		RULEBASED: 0,
		BRAITENBERG: 1
	};

	// Pseudo-enum for sensor names
	this.sensors = {
		LEFT: 0,
		CENTERLEFT: 1,
		CENTERRIGHT: 2,
		RIGHT: 3
	};

	// Braitenberg coefficients
	this.braitenberg = {
		wheelLeft:
		{
			left: 0,
			centerLeft: -10,
			centerRight: 100,
			right: 50
		},
		wheelRight:
		{
			left: 50,
			centerLeft: 100,
			centerRight: -10,
			right: 0
		}
	}

	var self = this;

	UI.activeTabReference = this;
	$("#content").load("./tabs/obstacle_avoidance.html", function()
	{
		document.getElementById("maxSpeed").oninput = function()
		{
			$(this).next("span").html(this.value);
		};

		$("#toggle").click(function()
		{
			self.avoiding = !self.avoiding;
			if(self.avoiding)
			{
				this.value = "Stop";
				this.style.background = "#f00";
			}
			else
			{
				// In case the robot was moving stop it
				self.serialDevice.send("s", [0, 0]);
				this.value = "Start";
				this.style.background = "#0f0";
			}
		});

		// Add listener for incoming data
		self.serialDevice.addListener(function(info)
		{
			self.read(info);
		});

		self.update();
	});
}

TABS.obstacle_avoidance.read = function(info)
{
	var data = new Uint8Array(info.data);

	for(var i = 0; i < data.length; i++)
	{
		switch(data[i])
		{
			case 111: // o
				// Beginning
				this.buffer = "";
				this.data = [];
				break;
			case 10: // line feed
				this.data.push(parseInt(this.buffer));
				if(this.data.length == 4)
				{
					this.avoid();
				}
				this.buffer = "";
				break;
			default:
				this.buffer += String.fromCharCode(data[i]);
		}
	}
}

TABS.obstacle_avoidance.avoid = function()
{
	// Update the UI
	for(var i = 0; i < 4; i++)
	{
		var color = ("00" + (this.data[i] >> 2).toString(16)).slice (-2);
		$("#sensor-" + (i + 1)).css("background-color", "#" + color + color + color);
		$("#sensor-" + (i + 1) + "-value").html(this.data[i]);
	}

	var maxSpeed = $("#maxSpeed").val();
	var speedLeft = 0;
	var speedRight = 0;

	if($("#controlArchitecture").val() == this.controlArchitectures.RULEBASED)
	{
		// First check the center sensors and the obstacle is immediately in front
		if(this.data[this.sensors.CENTERLEFT] < 512)
		{
			speedLeft = maxSpeed;
			speedRight = -maxSpeed;
		}
		else if(this.data[this.sensors.CENTERRIGHT] < 512)
		{
			speedLeft = -maxSpeed;
			speedRight = maxSpeed;
		}
		else if(this.data[this.sensors.LEFT] < 512)
		{
			speedLeft = maxSpeed;
			speedRight = 0;
		}
		else if(this.data[this.sensors.RIGHT] < 512)
		{
			speedLeft = 0;
			speedRight = maxSpeed;
		}
	}
	else if($("#controlArchitecture").val() == this.controlArchitectures.BRAITENBERG)
	{
		// Normalize sensor values to between 0 and 1
		for(var i = 0; i < 4; i++)
		{
			this.data[i] = this.data[i] / 1024;	
		}

		// Left wheen will go at max speed and is inhibited by sensors of the right
		speedLeft = this.data[this.sensors.LEFT] * this.braitenberg.wheelLeft.left +
			this.data[this.sensors.CENTERLEFT] * this.braitenberg.wheelLeft.centerLeft +
			this.data[this.sensors.CENTERRIGHT] * this.braitenberg.wheelLeft.centerRight +
			this.data[this.sensors.RIGHT] * this.braitenberg.wheelLeft.right;

		speedRight = this.data[this.sensors.LEFT] * this.braitenberg.wheelRight.left +
			this.data[this.sensors.CENTERLEFT] * this.braitenberg.wheelRight.centerLeft +
			this.data[this.sensors.CENTERRIGHT] * this.braitenberg.wheelRight.centerRight +
			this.data[this.sensors.LEFT] * this.braitenberg.wheelRight.right;

		// Round off values
		speedLeft = speedLeft | 0;
		speedRight = speedRight | 0;
	}

	// Make sure the speed stays between maxSpeed and -maxSpeed for both wheels
	if(speedLeft > maxSpeed)
	{
		speedLeft = maxSpeed;
	}
	else if(speedLeft < -maxSpeed)
	{
		speedLeft = -maxSpeed;
	}

	if(speedRight > maxSpeed)
	{
		speedRight = maxSpeed;
	}
	else if(speedRight < -maxSpeed)
	{
		speedRight = -maxSpeed;
	}

	// Apply values
	if(this.avoiding)
	{
		this.serialDevice.send("s", [speedLeft, speedRight]);
	}
}

TABS.obstacle_avoidance.update = function()
{
	this.serialDevice.send("o");

	if(!this.nextUpdate)
	{
		var self = this;
		this.nextUpdate = window.setTimeout(function()
		{
			self.nextUpdate = false;
			self.update();
		}, this.delay);
	}
}

TABS.obstacle_avoidance.cleanup = function()
{
	if(this.nextUpdate)
	{
		window.clearTimeout(this.nextUpdate);
	}
}
