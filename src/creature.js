function Creature()
{
	this.x = 0;
	this.y = 0;

	// default staus for a creature
	this.look = "x";

	this.name = "creature";

	this.curHP = 2;
	this.maxHP = 2;
}

Creature.prototype.move = function(x, y)
{
    this.x = x;
    this.y = y;
}

// when a creatures walks into into another creature
Creature.prototype.collides = function( collider )
{
	this.attack(collider);
}

// when a creature attacks an enemy
Creature.prototype.attack = function( enemy )
{
	//the enemy is damaged
	enemy.curHP-= 1;

	console.log(enemy.name + " " + enemy.curHP + "/" + enemy.maxHP);

	// check if the enemy is dead after every attack
	if (!enemy.isAlive())
		enemy.look = "x";
}

// death is when a creature drops to 0 or less health
Creature.prototype.isAlive = function()
{
	if (this.curHP > 0)
		return true;
	else
		return false;
}