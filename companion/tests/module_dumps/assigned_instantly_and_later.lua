local Methods = {
	Foo = function() end,
	Bar = 3,
	["Baz"] = 4,
}

function Methods:Qun()
	return "qun"
end

return Methods
