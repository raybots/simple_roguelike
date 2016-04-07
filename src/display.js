function Display(renderWidth, renderHeight)
{

	this.element = jQuery("<div id = displayBackground></div>");

	this.element.css({
		"position":"absolute",
		"color":"#444444",
		"width":100,
		"height":100,
		"font": "12px Courier New",
		"white-space": "nowrap",
		"line-height": 0.65,
		"text-align":"left",
		"background-color": "#f7f7f7",
		//"background": "-webkit-gradient(linear, center top, center bottom, from(#f7f7f7), to(#dbdbdb))",
		"border":"1px solid #d2d2d2",
		"border-top-color":"#e9e9e9",
		"cursor":"pointer",	
		});

	this.element.draggable();

	this.renderWidth = renderWidth - (renderWidth % 2);
	this.renderHeight = renderHeight - (renderHeight % 2);
	this.renderMod = (this.renderWidth / 2) + 1;
}

Display.prototype.update = function(wallGrid, player, monsterArray)
{
	var output = "";
	//var renderGrid = new Grid(wallGrid.width, wallGrid.height);

	var renderGrid = new Grid(this.renderWidth, this.renderHeight);

	for (var y = 0; y < renderGrid.height; y++)
	{
		for (var x = 0; x < renderGrid.width; x++)
		{
			var renderX = player.x - this.renderMod + x;
			var renderY = player.y - this.renderMod + y;

			if (wallGrid.getVal(renderX, renderY) == 0)
			{
				renderGrid.setVal(x, y, "&nbsp;")
			}
			else if (wallGrid.getVal(renderX, renderY) == 1)
			{
				renderGrid.setVal(x, y, "#");
			}
			else if (wallGrid.getVal(renderX, renderY) == null)
			{
				// if out of range
				renderGrid.setVal(x, y, "+");
			}
		}
	}

	var startX = this.renderMod - player.x;
	var startY = this.renderMod - player.y;

	for (var i = 0; i < monsterArray.length; i++)
	{
		renderGrid.setVal(startX + monsterArray[i].x, startY + monsterArray[i].y, monsterArray[i].look);
	}

	renderGrid.setVal(this.renderMod, this.renderMod, player.look);	

	for (var y = 0; y < renderGrid.height; y++)
	{
		for (var x = 0; x < renderGrid.width; x++)
		{
			output+= renderGrid.getVal(x,y);
		}

		output+= "<br/>";
	}	

	this.element.html(output);
}