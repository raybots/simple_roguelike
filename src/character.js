RayGame.subclass( Character, Creature);

function Character()
{
	Creature.call(this);

	this.look = "@";

	this.name = "Ray";

	this.curHP = 30;
	this.maxHP = 30;
}