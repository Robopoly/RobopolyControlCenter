"use strict";

TABS.linear_camera = {};
TABS.linear_camera.initialize = function(serialDevice)
{
	this.serialDevice = serialDevice;
	this.nextUpdate = false;
	this.buffer = "";
	this.maxData = 102;
	this.data = [];
	this.averageMax = [];

	this.follow = false;
	this.followHysteresis = 5;

	// Delay between measurements in milliseconds
	this.delay = 100;

	var self = this;

	UI.activeTabReference = this;
	$("#content").load("./tabs/linear_camera.html", function()
	{
		document.getElementById("exposureTime").oninput = function()
		{
			$(this).next("span").html(this.value);
			self.serialDevice.send("e", [this.value >> 8, this.value & 0xff]);
		};

		document.getElementById("threshold").oninput = function()
		{
			$(this).next("span").html(this.value);
		};

		document.getElementById("maxSpeed").oninput = function()
		{
			$(this).next("span").html(this.value);
		};

		// Initialize graph
		for(var i = 0; i < self.maxData; i += 1)
		{
			self.data.push([i, 120 * Math.cos(Math.PI * i / 50 + Math.PI) + 127]);
		}

		// Dummy data
		var minimum = [[0, 7], [self.maxData, 7]];
		var maximum = [[0, 247], [self.maxData, 247]];
		var average = [[0, 127], [self.maxData, 127]];
		var peak = [[50, 0], [50, 247]];
		var threshold = [[0, 191], [self.maxData, 191]];

		var graphData = [
			{data: self.data, color: "#f00", label: "Intensity", lines: {steps: true}},
			{data: minimum, color: "#f0f", label: "Minimum"},
			{data: maximum, color: "#ff0", label: "Maximum"},
			{data: average, color: "#0ff", label: "Average"},
			{data: peak, color: "#00f", label: "Peaks", bars: {show: true, barWidth: 30, align: "center"}},
			{data: threshold, color: "#0f0", label: "Threshold"}
		];

		self.plot = $.plot("#plot", graphData, {yaxis: {min: 0, max: 256, tickSize: 64}, xaxis: {min: 0, max: self.maxData}, legend: {container: $("#legendContainer")}});

		window.onresize = function()
		{
			self.plot.resize();
			self.plot.setupGrid();
			self.plot.draw();
		};

		// Show/hide legend
		$("#legend").change(function()
		{
			$("#legendContainer").toggle(this.checked);
		});

		// Toggle light following button
		$("#toggle").click(function()
		{
			self.follow = !self.follow;
			if(self.follow)
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

TABS.linear_camera.read = function(info)
{
	var data = new Uint8Array(info.data);

	for(var i = 0; i < data.length; i++)
	{
		switch(data[i])
		{
			case 99: // c
				// Beginning
				this.buffer = "";
				this.data = [];
				break;
			case 10: // line feed
				this.data.push([this.data.length, parseInt(this.buffer)]);
				if(this.data.length == this.maxData)
				{
					this.updateGraph();
				}
				this.buffer = "";
				break;
			default:
				this.buffer += String.fromCharCode(data[i]);
		}
	}
}

TABS.linear_camera.updateGraph = function()
{
	var minimum = 255;
	var maximum = 0;
	var average = 0;

	for(var i = 0; i < this.maxData; i++)
	{
		if(this.data[i][1] < minimum)
		{
			minimum = this.data[i][1];
		}

		if(this.data[i][1] > maximum)
		{
			maximum = this.data[i][1];
		}

		// Running average
		average = (this.data[i][1] + average * i) / (i + 1);
	}

	// Round off
	average = average | 0;

	var plotData = [
		{data: this.data, color: "#f00", label: "Intensity", lines: {steps: true}},
		{data: [[0, minimum], [this.maxData, minimum]], color: "#f0f", label: "Minimum"},
		{data: [[0, maximum], [this.maxData, maximum]], color: "#ff0", label: "Maximum"}
	];

	// Evaluate peak position(s)
	var peaks = [];
	var peakCenter, peakStart = -1, peakMax = 0;
	var peakHighest = {position: 0, height: 0};

	var threshold = $("#useAverageThreshold").is(':checked') ? average : $("#threshold").val();

	for(var i = 0; i < this.maxData; i++)
	{
		if(this.data[i][1] > threshold && peakStart == -1)
		{
			peakStart = i;
		}

		if(peakStart != -1 && this.data[i][1] > peakMax)
		{
			peakMax = this.data[i][1];
		}

		if((this.data[i][1] < threshold || i == this.maxData - 1) && peakStart != -1)
		{
			// Get the average and round off
			peakCenter = ((i + peakStart) / 2) | 0;

			// Save the highest peak
			if(peakHighest.height < peakMax)
			{
				peakHighest = {position: peakCenter, height: peakMax};
			}

			// Add the peak data to the plot
			plotData.push({data: [[peakCenter, peakMax]], color: "#00f", bars: {show: true, barWidth: (i - peakStart), align: "center"}});
			peaks.push(peakCenter);
			peakStart = -1;
			peakMax = 0;
		}
	}

	if($("#useAverageThreshold").is(':checked'))
	{
		plotData.push({data: [[0, average], [this.maxData, average]], color: "#0f0", label: "Threshold"});
	}
	else
	{
		plotData.push({data: [[0, average], [this.maxData, average]], color: "#0ff", label: "Average"});
		plotData.push({data: [[0, $("#threshold").val()], [this.maxData, $("#threshold").val()]], color: "#0f0", label: "Threshold"});
	}

	this.plot.setData(plotData);
	this.plot.draw();

	// Update text fields below the plot
	$("#minimum").html(minimum);
	$("#maximum").html(maximum);
	$("#average").html(average);
	$("#difference").html(maximum - minimum);

	$("#peaks").html(peaks.join(", "));

	if($("#dynamicExposure").is(':checked'))
	{
		this.averageMax.push(maximum);

		// Automatically correct exposure time, raise if the average is below 250 and lower when above
		if(this.averageMax.length == 3)
		{
			average = 0;
			for(var i = 0; i < this.averageMax.length; i++)
			{
				average = (this.averageMax[i] + average * i) / (i + 1);
			}

			var exposureTime = parseInt($("#exposureTime").val());

			// Update the UI and the device
			if(average > 250 && exposureTime > $("#exposureTime").prop("min"))
			{
				exposureTime -= 5;
				$("#exposureTime").val(exposureTime);
				$("#exposureTime").next("span").html(exposureTime);
				this.serialDevice.send("e", [exposureTime >> 8, exposureTime & 0xff]);
			}
			else if(average < 250 && exposureTime < $("#exposureTime").prop("max"))
			{
				exposureTime += 5;
				$("#exposureTime").val(exposureTime);
				$("#exposureTime").next("span").html(exposureTime);
				this.serialDevice.send("e", [exposureTime >> 8, exposureTime & 0xff]);
			}
			this.averageMax = [];
		}
	}
	else
	{
		// Reset the value in case it was disabled
		this.averageMax = [];
	}

	if(this.follow)
	{
		if(peakHighest.height == 0)
		{
			this.serialDevice.send("s", [0, 0]);
			return;
		}

		var maxSpeed = $("#maxSpeed").val();
		if(peakHighest.position < this.maxData / 2 - this.followHysteresis)
		{
			this.serialDevice.send("s", [0, maxSpeed]);
		}
		else if(peakHighest.position > this.maxData / 2 + this.followHysteresis)
		{
			this.serialDevice.send("s", [maxSpeed, 0]);
		}
		else
		{
			this.serialDevice.send("s", [maxSpeed, maxSpeed]);
		}
	}
}

TABS.linear_camera.update = function()
{
	this.serialDevice.send("c");

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

TABS.linear_camera.cleanup = function()
{
	if(this.nextUpdate)
	{
		window.clearTimeout(this.nextUpdate);
	}
}
