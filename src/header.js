RayGame = {};

RayGame.definedClasses = new Array();

/** This is a helper function to create subclasses */
RayGame.subclass = function( subClass, baseClass )
{
   function inheritance() {}
   inheritance.prototype = baseClass.prototype;

   subClass.prototype = new inheritance();
   subClass.prototype.constructor = subClass;
   subClass.baseConstructor = baseClass;
   subClass.superClass = baseClass.prototype;
   
   if (RayGame.definedClasses[subClass])
		alert( subClass + " has already been defined. Make sure your classes aren't named twice." );
		
   RayGame.definedClasses[subClass] = true;
}

Array.prototype.max = function(){
    return Math.max.apply( Math, this );
};

function lineDistance(x0, y0, x1, y1){
    return Math.sqrt((x0 -= x1) * x0 + (y0 -= y1) * y0);
};

function getLine(x0, y0, x1, y1, yArrayOld)
{
   var newWidth= yArrayOld[0].length;
   var newHeight = yArrayOld.length;

   var lineArray = []
   
   var dx = Math.abs(x1-x0);
   var dy = Math.abs(y1-y0);
   var sx = (x0 < x1) ? 1 : -1;
   var sy = (y0 < y1) ? 1 : -1;
   var err = dx-dy;

   while(true){
   
   // only draw within bounds - need to check for voronoi diagram
   if (y0 >= 0 && y0< newHeight && x0 >= 0 && x0< newWidth)
   {
       lineArray.push(yArrayOld[y0][x0]);
   }
   
    //setPixel(x0,y0);  // Do what you need to for this

    if ((x0==x1) && (y0==y1)) break;
    var e2 = 2*err;
    if (e2 >-dy){ err -= dy; x0  += sx; }
    if (e2 < dx){ err += dx; y0  += sy; }

   }
   
   return lineArray;
}