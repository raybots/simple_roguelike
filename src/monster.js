RayGame.subclass( Monster, Creature);

function Monster(moveCallback)
{
	Creature.call(this);

	// stats to indicate a default rat creature
	this.look = "r"
	this.range = 20;
	this.seenPlayer = false;

	this.moveCallback = moveCallback;
}

// draw a line from the monster to the character to see if the monster has line of sight
Monster.prototype.hasLOS = function(playerX, playerY, wallGrid)
{
	var lineArray = getLine(this.x, this.y, playerX, playerY, wallGrid.matrix);

	var hasLOS = true;

	if (lineArray.length > 0)
	{
		for (var i = 0; i < lineArray.length; i++)
		{
			if (lineArray[i] == 1)
			{	
				hasLOS = false;
			}
		}
	}
	else
	{
		hasLOS = false;
	}

	if (hasLOS)
		this.seenPlayer = true;

	return hasLOS;
}

// if the monster has line of sight to the player, it will use the A* search algorithm to chase the player
Monster.prototype.process = function(playerX, playerY, wallGrid, creatureGrid)
{
	if (lineDistance(playerX, playerY, this.x, this.y) <= this.range || this.seenPlayer == true)
	{
		if (this.hasLOS(playerX, playerY, wallGrid) || this.seenPlayer == true)
		{
			// A Star search algorithm used to find path
			var finder = new PF.AStarFinder();

			var grid = new PF.Grid(wallGrid.width, wallGrid.height, wallGrid.matrix);

			for (var y = 0; y < creatureGrid.height; y++)
			{
				for (var x = 0; x < creatureGrid.width; x++)
				{
					// account for other creatures that might be in the way
					if (creatureGrid.getVal(x, y))
					{	
						if (!creatureGrid.getVal(x, y).isAlive)
							grid.setWalkableAt(x, y, false);
					}
				}
			}

			// monster should always try to reach the player
			grid.setWalkableAt(playerX, playerY, true);			

			var path = finder.findPath(this.x, this.y, playerX, playerY, grid);

		    if (path.length > 1)
		    {
		    	var posX = path[1][0];
		    	var posY = path[1][1];

			    this.moveCallback(posX, posY, this);
			}
		}
	}

}