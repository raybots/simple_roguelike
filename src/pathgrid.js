RayGame.subclass( PathGrid, Grid);

function PathGrid(width, height)
{

	Grid.call(this, width, height);

	// init
	for (var y = 0; y < this.height; y++)
	{
		for (var x = 0; x < this.width; x++)
		{
			this.setVal(x, y, null);
		}
	}

}

PathGrid.prototype.applyObstacles = function(landscape)
{
	// init
	for (var y = 0; y < this.height; y++)
	{
		for (var x = 0; x < this.width; x++)
		{
			if (landscape[y][x] == 1)
			{
				this.setVal(x, y, -2);
			}
		}
	}
}

PathGrid.prototype.getMaxSteps = function()
{
	var valArray = []

	// init
	for (var y = 0; y < this.height; y++)
	{
		for (var x = 0; x < this.width; x++)
		{

			if (this.getVal(x, y) > 0)
			{
				valArray.push(this.getVal(x, y));
			}
		}
	}

	return valArray.max();
}


PathGrid.prototype.splash = function(x, y, steps)
{
	var coord =[];

	coord.push([0,-1]);
	coord.push([1,0]);
	coord.push([0,1]);
	coord.push([-1,0]);

	for (var i = 0; i < coord.length; i++)
	{

	var posX = x + coord[i][0];
	var posY = y + coord[i][1];

	if (this.contains(posX, posY))
	{
		if (!this.getVal(posX, posY) || this.getVal(posX, posY) > steps && this.getVal(posX, posY) != -2)
		{
			this.setVal(posX, posY, steps);

			this.splash(posX, posY, steps + 1);
		}
	}
	}
}