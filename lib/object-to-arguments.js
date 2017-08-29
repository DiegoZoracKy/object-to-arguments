'use strict';

const splitSkip = require('split-skip');
const unpack = require('unpack-string');
const inspectFunction = require('inspect-function');
const stringifyParameters = require('stringify-parameters');
const { getParametersNames, inspectParameters, getParametersNamesFromInspection } = require('inspect-parameters-declaration');

const isArrayLike = p => p.match(/^\[+/) || undefined;
const isObjectLike = p => p.match(/^{+/) || undefined;
const matchObjectProperty = p => p.match(/^([^{]+):(.*)/) || undefined;

function setDestructuringParameterArgumentsIntoObject(parameter, data) {
	const unpackedParameter = unpack(parameter);
	const inspectedParameters = inspectParameters(unpackedParameter);

	return inspectedParameters.reduce((parameterValue, inspectedParameter) => {
		let objectProperty = matchObjectProperty(inspectedParameter.parameter);
		if (objectProperty) {
			let [, key, value] = objectProperty.map(v => v.trim());
			let [valueInspectedParameter] = inspectParameters(value);
			parameterValue[key] = setArgumentValue(valueInspectedParameter, data);
		} else {
			parameterValue[inspectedParameter.parameter] = setArgumentValue(inspectedParameter, data);
		}

		return parameterValue;
	}, {});
}

function setDestructuringParameterArgumentsIntoArray(parameter, data) {
	const unpackedParameter = unpack(parameter);
	const inspectedParameters = inspectParameters(unpackedParameter);
	return prepareArgumentsArray(inspectedParameters, data);
}

function setDestructuringParameterArguments(parameter, data) {
	if (isArrayLike(parameter)) {
		return setDestructuringParameterArgumentsIntoArray(parameter, data);
	}

	if (isObjectLike(parameter)) {
		return setDestructuringParameterArgumentsIntoObject(parameter, data);
	}
}

function setArgumentValue({ parameter, expectsDestructuring, defaultValue } = {}, data) {
	if (!expectsDestructuring) {
		return data[parameter];
	}

	if (defaultValue) {
		const someDestructuringParameterIsSet = getParametersNames(parameter).some(parameterName => data[parameterName]);
		if (!someDestructuringParameterIsSet) {
			return undefined;
		}
	}

	return setDestructuringParameterArguments(parameter, data);
}

function prepareArgumentsArray(inspectedParameters, data = {}) {
	return inspectedParameters.map(inspectedParameter => setArgumentValue(inspectedParameter, data));
}

function prepare(fn, object = {}) {
	if (object.constructor === String) {
		try {
			object = JSON.parse(object);
		} catch (ex) {
			return [];
		}
	}

	const dataKeys = Object.keys(object);
	if (!fn || !dataKeys.length) {
		return [];
	}

	const parameters = stringifyParameters(fn);
	const inspectedParameters = inspectParameters(parameters).filter(inspectedParameter => !inspectedParameter.parameter.match(/^\.{3}/));
	const argumentsArray = inspectedParameters && inspectedParameters.length ? prepareArgumentsArray(inspectedParameters, object) : [];

	const expectedArgumentsNames = getParametersNamesFromInspection(inspectedParameters);
	dataKeys.forEach(key => {
		if (!expectedArgumentsNames.includes(key)) {
			argumentsArray.push(object[key]);
		}
	});

	return argumentsArray;
}

function call(fn, object = {}) {
	return fn(...prepare(fn, object));
}

module.exports = { prepare, call };