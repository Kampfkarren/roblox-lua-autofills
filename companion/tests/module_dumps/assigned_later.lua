local Methods = {}

function Methods:Foo()
	print("foo")
end

function Methods.Bar()
	print("bar")
end

Methods.Baz, Methods.Qun = 3, 4
Methods["Doge"] = 5

return Methods
