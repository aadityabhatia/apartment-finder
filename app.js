var blaze = blaze || {};

const DEST_LAT = 37.39257;
const DEST_LONG = -122.07979;
const RADIUS_OF_EARTH = 3963; // miles
const MAX_AERIAL_DISTANCE = 10; // same as above

const MARGINS_VERTICAL_MAP = 80;

const DATA_URL = "http://pipes.yahoo.com/pipes/pipe.run?Area=sfbay&Region=sby&Region2=pen&_id=4c04a69e86787da5a0a08d33dac93aa1&_render=json";

$(function () {

	$(window).resize(function() {
		$("#map").height($(window).height() - MARGINS_VERTICAL_MAP);
	});
	$(window).resize();

	blaze.map = new google.maps.Map(document.getElementById("map"), {
		center: new google.maps.LatLng(DEST_LAT, DEST_LONG),
		zoom: 15,
		mapTypeId: google.maps.MapTypeId.ROADMAP
	});

	$("button#load").click(function() {
		$("#content").html("Loading...");
		$.ajax(DATA_URL, {
			success: function(data, textStatus) {
				console.log(data.value);
				loadResults(data.value.items);
			}
		});
	});

	$("#content").on('click', "a.show", function(event) {
		console.log(event);
		return false;
	});

	function loadResults(items) {

		var contentPanel = $("#content");
		var addresses = [];
		var divs = [];

		for (var i = 0; i < items.length; i++) {
			var item = items[i];
			var loc = item.description.match(/(http:\/\/maps.google.com\/\?q=loc%3A\+(.*))"/);
			if(loc && loc.length > 1) {
				item.address = decodeURIComponent(loc[2]).replace(/\+/g, ' ');
				item.mapLink = loc[1];
			} else {
				item.mapLink = "#";
				item.address = "";
			}
		}

		items = items.filter(function(item) {
			if(!item['geo:lat']) {
				return false;
			}
			var lat1 = item['geo:lat'] * Math.PI / 180;
			var long1 = item['geo:long']* Math.PI / 180;
			var lat2 = DEST_LAT* Math.PI / 180, long2 = DEST_LONG* Math.PI / 180;
			var x = (long2-long1) * Math.cos((lat1+lat2)/2);
			var y = (lat2-lat1);
			var d = Math.sqrt(x*x + y*y) * RADIUS_OF_EARTH;
			item.distance = d.toPrecision(4);
			return d < MAX_AERIAL_DISTANCE;
		});

		createTable($('#content'), items);
	};

	function createTable(contentPanel, data) {
		contentPanel.html('<table cellpadding="0" cellspacing="0" border="0" class="display" id="contentTable"></table>');
		var table = $('#contentTable').dataTable({
			"aaData": data,
			"bPaginate": false,
			"bLengthChange": false,
			"bFilter": false,
			"bSort": true,
			"bInfo": false,
			"bAutoWidth": true,
			"aoColumns": [
				{sTitle: "Title", mDataProp: "title"},
				{sTitle: "Distance", mDataProp: "distance"},
				{sTitle: "Time", mDataProp: "distance"}
			]
		});

		table.on('click', 'tr', function(event) {
			var item = table._(event.srcElement.parentElement)[0];
			console.log(item);

			if(!item.address) {
				return;
			}

			blaze.distanceService = blaze.distanceService || new google.maps.DistanceMatrixService();
			blaze.distanceService.getDistanceMatrix({
				origins: [item.address],
				destinations: [new google.maps.LatLng(DEST_LAT, DEST_LONG)],
				travelMode: google.maps.TravelMode.DRIVING,
				avoidHighways: false,
				avoidTolls: false
			}, function(response, status) {
				if (status != "OK") {
					console.error(status);
					return;
				}
				console.log(response);
				var distance = response.rows[0].elements[0].duration.text;
				if(distance) {
					table.fnUpdate(distance, event.srcElement.parentElement, 2);
				} else {
					console.error("distance: " + distance);
				}
			});

			blaze.geocoder = blaze.geocoder || new google.maps.Geocoder();
			blaze.geocoder.geocode( { 'address': item.address}, function(results, status) {
				if (status == google.maps.GeocoderStatus.OK) {
					blaze.map.setCenter(results[0].geometry.location);
					var marker = new google.maps.Marker({
						map: blaze.map,
						position: results[0].geometry.location
					});
				} else {
					console.error("Geocode failed: " + status);
				}
			});
		});
	};
});
