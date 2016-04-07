function Creature()
{
	this.x = 0;
	this.y = 0;

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

Creature.prototype.collides = function( collider )
{
	//Game logic / combat
	this.attack(collider);
}

Creature.prototype.attack = function( enemy )
{
	//Game logic / combat

	enemy.curHP-= 1;

	console.log(enemy.name + " " + enemy.curHP + "/" + enemy.maxHP);

	if (!enemy.isAlive())
		enemy.look = "x";
}

Creature.prototype.isAlive = function()
{
	if (this.curHP > 0)
		return true;
	else
		return false;
}