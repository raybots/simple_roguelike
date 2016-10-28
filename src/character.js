RayGame.subclass( Character, Creature);

function Character()
{
	Creature.call(this);

	// default stats for the player
	this.look = "@";
	this.name = "Ray";

	this.curHP = 30;
	this.maxHP = 30;
}