var blaze = blaze || {};

const DEST_LAT = 37.39257;
const DEST_LONG = -122.07979;
const RADIUS_OF_EARTH = 3963; // miles
const RADIUS_SEARCH_DEFAULT = 999; // miles

const ELEMENT_STATIC_MAP = "<img src='http://maps.googleapis.com/maps/api/staticmap?center={0}&zoom=13&size=400x400&sensor=false&scale=2&markers={0}'>";

const DATA_URL = "http://pipes.yahoo.com/pipes/pipe.run?Area=sfbay&Region=sby&Region2=pen&maxRent={0}&bedrooms={1}&_id=4c04a69e86787da5a0a08d33dac93aa1&_render=json";

String.prototype.format = function() {
	var args = arguments;
	return this.replace(/{(\d+)}/g, function(match, number) {
		return typeof args[number] != 'undefined'
			? args[number]
			: match
		;
	});
};

$(function () {
    if ($(".show-on-phones").css('display') == "block") {
    	blaze.phone = true;
        $("#descriptionContainerMobile").prepend($("#description"));
    }
});

$(function () {

	$("button#load").click(function() {
		$("#ajaxLoader").fadeIn();
		$('#formListApartments').hide();
		$("#showListForm").fadeIn();
		$.ajax(DATA_URL.format($("#inMaxRent").val(), $("#inBedrooms").val()), {
			success: function(data, textStatus) {
				console.log(data.value);
				$("#ajaxLoader").css('display', 'none');
				loadResults(data.value.items);
				$("#scrollTop").fadeIn();
			}
		});
	});

	$("button#showListForm").click(function() {
		$('#formListApartments').show();
		$("#showListForm").fadeOut();
		$("#scrollTop").fadeOut();
		$("#descriptionContainerMobile").fadeOut();
		$("#content").html("");
	});

	$("#scrollTop").click(function() {
		setTimeout(function(){
			$('body').animate({scrollTop: 0});
		}, 20);
	});

	$("input").each(function(index, element){
		var value = localStorage.getItem('field-' + (element.name || element.id));
		if(value)
			element.value = value;
	});

	$("input").change(function(event) {
		var element = event.srcElement;
		localStorage.setItem('field-' + (element.name || element.id), element.value);
	});

	function aerialDistance(lat1, long1, lat2, long2) {
		lat1 *= Math.PI / 180;
		lat2 *= Math.PI / 180;
		long1 *= Math.PI / 180;
		long2 *= Math.PI / 180;
		var x = (long2-long1) * Math.cos((lat1+lat2)/2);
		var y = (lat2-lat1);
		return Math.sqrt(x*x + y*y) * RADIUS_OF_EARTH;
	}

	function loadResults(items) {

		var contentPanel = $("#content");

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

			var rent = item['dc:title'].match(/\$(\d+) /);
			if(rent && rent.length > 1) {
				item.rent = rent[1];
			} else {
				item.rent = "unknown";
			}

			if(!item['geo:lat']) {
				item.aerialDistance = RADIUS_SEARCH_DEFAULT;
				item.driveTime = "unknown";
				return true;
			}
			item.aerialDistance = aerialDistance(item['geo:lat'], item['geo:long'], DEST_LAT, DEST_LONG);
			item.driveTime = item.aerialDistance.toPrecision(2) + " miles";
		}

		var searchRadius = +$("#inRadius").val() || RADIUS_SEARCH_DEFAULT;
		items = items.filter(function(item) {
			return item.aerialDistance <= searchRadius;
		});

		createTable($('#content'), items);
	};

	function createTable(contentPanel, data) {
		contentPanel.html('<table cellpadding="0" cellspacing="0" border="0" width="100%" id="contentTable"></table>');
		blaze.table = $('#contentTable').dataTable({
			"aaData": data,
			"bPaginate": false,
			"bLengthChange": false,
			"bFilter": false,
			"bSort": true,
			"bInfo": false,
			"bAutoWidth": true,
			"aoColumns": [
				{sTitle: "Title", mDataProp: "title"},
				{sTitle: "Drive", mDataProp: "driveTime"},
				{sTitle: "Rent", mDataProp: "rent"},
				{sTitle: "Distance", mDataProp: "aerialDistance", "bVisible": false},
			]
		});

		blaze.table.fnSort([[3, 'asc'], [2, 'asc']]);

		blaze.table.on('click', 'tr', function(event) {

			var item = blaze.table._(event.srcElement.parentElement)[0];
			displayItem(item);

			if(!item['geo:lat']) {
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
				var duration = response.rows[0].elements[0].duration.text;
				if(duration) {
					blaze.table.fnUpdate(duration, event.srcElement.parentElement, 1);
					item.driveTime = duration;
					displayItem(item);
				} else {
					console.error("distance: " + duration);
				}
			});
		});
	};

	function displayItem(item) {
		if(typeof(item) == "string") {
			$("#description").html(item);
			return;
		}
		var html = "<h2>" + item.title + "</h2>";
		html += "<h3><span class='green smallCaps'>Drive: " + item.driveTime + "</span></h3>";
		html += "<h4><span class='gray italic'>posted " + $.timeago(item.pubDate) + " (<a class='smallCaps' href='"+item.link+"'>link</a>)</span></h4>";
		html += item.description;
		if(item.address)
			html += ELEMENT_STATIC_MAP.format(item.address);
		$("#description").html(html);

		if(blaze.phone) {
			$('body').animate({scrollTop: $("#description").offset().top - 10});
		}
	}

	$(document).on('click', 'a', function(event) {
		var a = $(event.srcElement);
		if(a[0].host == window.location.host) {
			console.log("Local link clicked: %s", a[0].href);
			return false;
		} else {
			a.attr('target', '_blank');
			return true;
		}
	});
});
