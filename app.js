var blaze = blaze || {};

const DEST_LAT = 37.39257;
const DEST_LONG = -122.07979;
const RADIUS_OF_EARTH = 3963; // miles
const RADIUS_SEARCH_DEFAULT = 999; // miles

const ELEMENT_STATIC_MAP = "<img src='http://maps.googleapis.com/maps/api/staticmap?center={0},{1}&zoom=13&size=400x400&sensor=false&scale=2&markers={0},{1}'>";

const DATA_URL = "http://pipes.yahoo.com/pipes/pipe.run?maxRent={0}&bedrooms={1}&city=sfbay&region=sby,pen&_id=dca16869da698f662c6c8d1ed81e63f0&_render=json";

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

	$("button#load").click(function() {
		$("#ajaxLoader").fadeIn();
		$('#formListApartments').hide();
		$("#showListForm").fadeIn();
		$.ajax(DATA_URL.format($("#inMaxRent").val(), $("#inBedrooms").val()), {
			dataType: 'json',
			success: function(data, textStatus) {
				console.log(data.value);
				$("#ajaxLoader").css('display', 'none');
				loadResults(data.value.items);
				$("#scrollTop").fadeIn();
				expandTable();
			}
		});
	});

	$("button#showListForm").click(function() {
		$('#formListApartments').show();
		$("#showListForm").fadeOut();
		$("#scrollTop").fadeOut();
		$("#descriptionContainerMobile").fadeOut();
		$("#content").html("");
		expandTable();
	});

	$("#scrollTop").click(function() {
		setTimeout(function(){
			$('body').animate({scrollTop: 0});
		}, 20);
	});
	
	function expandDescription() {
		$('#formAndTable').switchClass('twelve', 'four');
		$('#description').fadeIn();
	}
	
	function expandTable() {
		$('#formAndTable').switchClass('four', 'twelve');
		$('#description').fadeOut();
		$('body').animate({scrollTop: 0});
	}

	$("input").each(function(index, element){
		var value = localStorage.getItem('field-' + (element.name || element.id));
		if(value)
			element.value = value;
	});

	$("input").change(function(event) {
		var element = event.target;
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

			var rent = item['dc:title'].match(/\$(\d+) /);
			if(rent && rent.length > 1) {
				item.rent = rent[1];
			} else {
				item.rent = "unknown";
			}

			if(!item['geo:lat']) {
				item.aerialDistance = RADIUS_SEARCH_DEFAULT;
				item.travelTime = "unknown";
				return true;
			}
			item.aerialDistance = aerialDistance(item['geo:lat'], item['geo:long'], DEST_LAT, DEST_LONG);
			item.travelTime = "[{0} miles]".format(item.aerialDistance.toPrecision(2));
		}

		var searchRadius = +$("#inRadius").val() || RADIUS_SEARCH_DEFAULT;
		items = items.filter(function(item) {
			return item.aerialDistance <= searchRadius;
		});

		createTable($('#content'), items);
	};

	function createTable(contentPanel, data) {
		var travelModeLabel = $('#inTravelMode').children('[selected]').text();

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
				{sTitle: travelModeLabel, mDataProp: "travelTime"},
				{sTitle: "Rent", mDataProp: "rent"},
				{sTitle: "Distance", mDataProp: "aerialDistance", "bVisible": false}
			]
		});

		blaze.table.fnSort([[3, 'asc'], [2, 'asc']]);

		blaze.table.on('click', 'tr', function(event) {

			var item = blaze.table._(event.target.parentElement)[0];
			displayItem(item);

			if(!item['geo:lat']) {
				return;
			}

			var travelMode = $('#inTravelMode').val();

			blaze.distanceService = blaze.distanceService || new google.maps.DistanceMatrixService();
			blaze.distanceService.getDistanceMatrix({
				origins: [new google.maps.LatLng(item['geo:lat'], item['geo:long'])],
				destinations: [new google.maps.LatLng(DEST_LAT, DEST_LONG)],
				travelMode: google.maps.TravelMode[travelMode],
				avoidHighways: false,
				avoidTolls: false
			}, function(response, status) {
				if (status != "OK") {
					console.error(status);
					return;
				}
				var duration = response.rows[0].elements[0].duration.text;
				if(duration) {
					blaze.table.fnUpdate(duration, event.target.parentElement, 1);
					item.travelTime = duration;
					displayItem(item);
				} else {
					console.error("distance: " + duration);
				}
			});
		});
	};

	function displayItem(item) {

		expandDescription();
		
		var travelModeLabel = $('#inTravelMode').children('[selected]').text();

		var html = "<h2>" + item.title + "</h2>";
		html += "<h3><span class='greenText smallCaps'>{0}: {1}</span></h3>".format(travelModeLabel, item.travelTime);
		html += "<h4><span class='grayText italic'>posted " + $.timeago(item.pubDate)
			+ " (<a class='smallCaps' href='" + item.link + "'>link</a>)</span>"
			+ "<button id='btnHideDescription' class='small round button'>return</button></h4>";
		html += item.description;
		if(item['geo:lat'])
			html += ELEMENT_STATIC_MAP.format(item['geo:lat'], item['geo:long']);
		$("#description").html(html);
		$("#btnHideDescription").click(function(){
			expandTable();
		});

		if(blaze.phone) {
			$('body').animate({scrollTop: $("#description").offset().top - 10});
		}
	}

	$(document).on('click', 'a', function(event) {
		var a = $(event.target);
		if(a[0].host == window.location.host) {
			console.log("Local link clicked: %s", a[0].href);
			return false;
		} else {
			a.attr('target', '_blank');
			return true;
		}
	});
});
