function Grid(width, height)
{
	this.width = width;
	this.height = height;

	this.matrix = [];
	
	// init
	for (var y = 0; y < this.height; y++)
	{
		this.matrix.push([]);

		for (var x = 0; x < this.width; x++)
		{
			this.matrix[y].push(0);
		}
	}
}

// clears all values in the grid
Grid.prototype.clear = function()
{
	for (var y = 0; y < this.height; y++)
	{
		for (var x = 0; x < this.width; x++)
		{
			this.setVal(x, y, null);
		}
	}
}

// gets a value at the specified coordinates
Grid.prototype.getVal = function(x, y)
{
	if (this.contains(x, y))
		return this.matrix[y][x];
	else
		return null;
}

// sets a value at the specified coordinates
Grid.prototype.setVal = function(x, y, val)
{
	if (this.contains(x, y))
		this.matrix[y][x] = val;
	else
		return false;
}

// checks whether the coordinates exist in the grid, a bounds check
Grid.prototype.contains = function(x, y)
{
	if (x >= 0 && x < this.width && y >= 0 && y < this.height)
		return true;
	else
		return false;
}