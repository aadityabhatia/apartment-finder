function feedLoaded(result) {

	window.result = result;

	if (!result.error) {
		var container = document.getElementById("content");
		container.innerHTML = '';

		var addresses = [];
		var divs = [];
		for (var i = 0; i < result.feed.entries.length; i++) {
			var entry = result.feed.entries[i];
			var loc = entry.content.match(/(http:\/\/maps.google.com\/\?q=loc%3A\+(.*))"/);
			var div = document.createElement("div");
			div.innerHTML = entry.title + " (<a href='" + entry.link + "' target='_blank'>link</a>)";
			div.id = "row" + i;
			container.appendChild(div);
			if(loc && loc.length > 1) {
				$(div).append(" (<a class='map' href='" + loc[1] + "' target='_blank'>map</a>)");
				addresses.push(loc[2]);
				divs.push(div);
			}
			$(div).append(" ("+ prettyDate(entry.publishedDate) +")");
		}

		var service = new google.maps.DistanceMatrixService();
		service.getDistanceMatrix(
		  {
		    origins: addresses,
		    destinations: [new google.maps.LatLng(37.39257, -122.07979)],
		    travelMode: google.maps.TravelMode.DRIVING,
		    avoidHighways: false,
		    avoidTolls: false
		  }, callback);

		function callback(response, status) {
			for (var i = 0; i < response.rows.length; i++) {
				row = response.rows[i];
				$("a.map", divs[i]).text(row.elements[0].duration.text);
			}
		}
	}
}

google.load("feeds", "1", {
	callback: function(){
		var feed = new google.feeds.Feed("http://sfbay.craigslist.org/search/apa/pen?srchType=A&minAsk=&maxAsk=2000&bedrooms=2&format=rss");
		feed.setNumEntries(10);
		feed.load(feedLoaded);
	}
});
