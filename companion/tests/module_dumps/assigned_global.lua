Data = {
	Foo = function() end,
	Bar = 3,
}

function Data:Baz()
	return "baz"
end

function Data.Qun()
	return "qun"
end

return Data
