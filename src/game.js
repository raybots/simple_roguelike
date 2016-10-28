Game.singleton = null;

function Game()
{
	// params for creating the display
	this.width = $(window).width();
	this.height = $(window).height();
	this.displayX = 20;
	this.displayY = 20;

	this.mapWidth = 60;
	this.mapHeight = 60;

	this.renderWidth = 40;
	this.renderHeight = 40;	

	this.element = $("<div id = 'gameBackground'>Use arrow keys to move!</div>");

	this.element.css({
		"position":"absolute",
		"width":this.width,
		"height":this.height,
		"background": "-webkit-gradient(linear, center top, center bottom, from(#f7f7f7), to(#dbdbdb))",		
	});

	$("#stage").append(this.element);

	var output = "";

	Game.singleton = this;
}

// the display is however many characters wide and tall
Game.prototype.setDisplaySize = function()
{
	var output = "";

	var clone = this.display.element.clone();

	for (var y = 0; y < this.renderHeight; y++)
	{
		for (var x = 0; x < this.renderWidth; x++)
		{
			output+= "x";
		}
		output+= "<br/>";
	}

	// need to create a clone first to figure out what the width with text will be
	clone.css({ "display": "inline-block", "width": "", "height": "" })

	$("body").append(clone);

	clone.html(output);

	this.display.element.css({"width":clone.outerWidth(),"height":clone.outerHeight()});
	this.display.element.show();

	clone.remove();
}

// all the big main stuff happens here
Game.prototype.start = function()
{
	this.player = new Character();

	this.level = new Level(this.mapWidth, this.mapHeight)

	this.level.placeCreature(this.player.x, this.player.y, this.player);

	this.level.genCave();

	this.createDisplay();
	this.addControls();

	this.updateScreen();
}

// positioning and addign the display
Game.prototype.createDisplay = function()
{
	this.display = new Display(this.renderWidth, this.renderHeight);
	this.display.element.hide();

	this.setDisplaySize();

	this.display.element.css({"left":this.displayX,"top":this.displayY});

	this.element.append(this.display.element);
}

// update the display with the current walls, players and monsters in the area
Game.prototype.updateScreen = function()
{
	this.display.update(this.level.wallGrid, this.player, this.level.monsterArray);
}

Game.prototype.addControls = function()
{

var moveCallback = $.proxy(this.move, this);	

$(document).keydown(function(e) {
    switch(e.which) {
        case 37: // left
        moveCallback("left");
        break;

        case 38: // up
        moveCallback("up");
        break;

        case 39: // right
        moveCallback("right");
        break;

        case 40: // down
        moveCallback("down");
        break;

        default: return; // exit this handler for other keys
    }
    e.preventDefault(); // prevent the default action (scroll / move caret)
});

}

// moves the player along the x and y axis. The monsters move as the player moves.
Game.prototype.move = function(direction)
{
	var x = this.player.x;
	var y = this.player.y;

	if (direction == "left")
		x-= 1;

	if (direction == "right")
		x+= 1;

	if (direction == "up")
		y-= 1;

	if (direction == "down")
		y+= 1;

	this.level.placeCreature(x, y, this.player);

	this.level.processMonsters(this.player.x, this.player.y);

	this.updateScreen();
}

Game.get = function()
{
	if ( !Game.singleton ) 
		new Game();
		
	return Game.singleton;
}