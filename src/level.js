function Level(width, height)
{
	this.width = width;
	this.height = height;

	this.monsterArray = [];

	this.wallGrid = new Grid(width, height);
	this.lookGrid = new Grid(width, height);
	this.creatureGrid = new Grid(width, height);

	this.creatureGrid.clear();
}

Level.prototype.placeCreature = function(x, y, creature)
{
	var canMove = false;

	if (this.wallGrid.getVal(x, y) == 0)
	{
		if (this.creatureGrid.getVal(x, y))
		{
			if (this.creatureGrid.getVal(x, y).isAlive())
				creature.collides(this.creatureGrid.getVal(x, y));
			else
				canMove = true;
		}
		else
			canMove = true;
	}

	if (canMove)
	{
		this.creatureGrid.setVal(creature.x, creature.y, null);
		creature.move(x, y);
		this.creatureGrid.setVal(x, y, creature);		
	}
}

Level.prototype.processMonsters = function(playerX, playerY)
{
	for (var i = 0; i < this.monsterArray.length; i++)
	{
		if (this.monsterArray[i].isAlive())
			this.monsterArray[i].process(playerX, playerY, this.wallGrid, this.creatureGrid);
	}
}

Level.prototype.genCave = function()
{
	for (var y = 5; y < this.wallGrid.height - 8; y++)
	{
		for (var x = 0; x < this.wallGrid.width; x++)
		{
			if (Math.random() > 0.55)
				this.wallGrid.setVal(x, y, 1);
		}
	}

	for (var i = 0; i < 5; i++)
		this.cull();

	this.addEnemies();	
}

Level.prototype.addEnemies = function()
{
	for (var y = Math.floor(this.width / 2); y < this.height - 8; y++)
	{
		for (var x = 0; x < this.width; x++)
		{
			if (Math.random() > 0.99 && this.wallGrid.getVal(x, y) == 0)
				this.spawnMonster(x, y);
		}
	}

	console.log(this.monsterArray.length + " monsters generated");
}

Level.prototype.spawnMonster = function(x, y)
{
	if (this.wallGrid.contains(x, y))
	{
		var moveCallback = jQuery.proxy(this.placeCreature, this);

		var monster = new Monster(moveCallback);

		this.placeCreature(x, y, monster);
		this.monsterArray.push(monster);
	}
	else
	{
		return false;	
	}
}

Level.prototype.cull = function()
{
	var tempGrid = new Grid(this.width, this.height);

	for (y = 0; y < tempGrid.height; y++)
	{
		for (x = 0; x < tempGrid.width; x++)
		{
			var wallCount = 0;

			for (var yCheck = y - 1; yCheck < (y + 2); yCheck++)
			{
				for (var xCheck = x - 1; xCheck < (x + 2); xCheck++)
				{
					if (this.wallGrid.getVal(xCheck, yCheck) == 1)
						wallCount++;
				}
			}

			if (wallCount >= 5)
				tempGrid.setVal(x, y, 1)
			else
				tempGrid.setVal(x, y, 0)
		}
	}	

	for (y = 0; y < tempGrid.height; y++)
	{
		for (x = 0; x < tempGrid.width; x++)
		{
			this.wallGrid.setVal(x, y, tempGrid.getVal(x,y));
		}
	}
}