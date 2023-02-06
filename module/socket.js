import {MORTAL_WEAKNESS_TARGET_SOURCEID, MORTAL_WEAKNESS_TARGET_UUID, PERSONAL_ANTITHESIS_TARGET_SOURCEID, PERSONAL_ANTITHESIS_TARGET_UUID,
		MORTAL_WEAKNESS_EFFECT_UUID, PERSONAL_ANTITHESIS_EFFECT_UUID, MORTAL_WEAKNESS_EFFECT_SOURCEID, PERSONAL_ANTITHESIS_EFFECT_SOURCEID} from "./utils.js";

import {getActorEVEffect, getGreatestIWR} from "./utils.js";

let socket;

Hooks.once("socketlib.ready", () => {
	socket = socketlib.registerModule("pf2e-thaum-vuln");
	socket.register("createEffectOnTarget", _socketCreateEffectOnTarget);
	socket.register("updateEVEffect", _socketUpdateEVEffect);
	socket.register("deleteEVEffect", _socketDeleteEVEffect);
});

export function createEffectOnTarget(a, t, effect) {
	let aID = a.uuid;
	let tID = t.actor.uuid;
	let eID = effect.uuid;
	return socket.executeAsGM(_socketCreateEffectOnTarget, aID, tID, eID);
}	

export function updateEVEffect(a, flag) {
	return socket.executeAsGM(_socketUpdateEVEffect, a, flag);
}

export function deleteEVEffect(a) {
	if(getActorEVEffect(a)){
		let targ = new Array;
		targ.push(a.getFlag("pf2e-thaum-vuln", "EVTargetID"));
		targ.push(a.uuid);
		
		return socket.executeAsGM(_socketDeleteEVEffect, targ);
	}
}

async function _socketCreateEffectOnTarget(aID, tID, eID) {
	
	const a = await fromUuid(aID);
	const t = await fromUuid(tID);
	const e = await fromUuid(eID);	

	let eff = e.toObject();
	
	const m = await fromUuid(MORTAL_WEAKNESS_TARGET_UUID);
	const p = await fromUuid(PERSONAL_ANTITHESIS_TARGET_UUID);
	
	if(eff.flags.core.sourceId === MORTAL_WEAKNESS_EFFECT_SOURCEID) {
		eff = m.toObject();
		if(t.system?.attributes?.weaknesses){
			eff.system.rules[0].value = getGreatestIWR(t.actor.system?.attributes?.weaknesses).value;
		} else if (t.actor.system?.attributes?.weaknesses) {
		eff.system.rules[0].value = getGreatestIWR(t.actor.system?.attributes?.weaknesses).value;
		}

	}else if(eff.flags.core.sourceId === PERSONAL_ANTITHESIS_EFFECT_SOURCEID) {
		eff = p.toObject();
		eff.system.rules[0].value = Math.floor(a.level / 2)+2;
	}
	a.setFlag("pf2e-thaum-vuln", "EVValue", `${eff.system.rules[0].value}`);
	await t.actor.createEmbeddedDocuments('Item', [eff]);
	return;
}

//This is a temporary fix until the next pf2e system update. The function hooks on renderChatMessage attack-rolls
//If the thaumaturge makes an attack-roll, the target's weakness updates with the correct amount
//If it's not the thaumaturge that makes the attack-roll, it changes the weakness to 0
async function _socketUpdateEVEffect(a, flag) {
	let eff;
	let tKey
	const trueThaum = canvas.tokens.objects.children.find(token => token.actor.items.find(item => item.getFlag("core","sourceId") === MORTAL_WEAKNESS_EFFECT_SOURCEID ? item : item.getFlag("core","sourceId") ===  PERSONAL_ANTITHESIS_EFFECT_SOURCEID)).actor;
	const evM = trueThaum.getFlag("pf2e-thaum-vuln","EVMode");
	const t = await fromUuid(trueThaum.getFlag("pf2e-thaum-vuln","EVTargetID"));
	const act = canvas.tokens.objects.children.find(token => token.actor.id === a).actor;
	const value = act.getFlag("pf2e-thaum-vuln","EVValue");
	if(evM === "mortal-weakness") {
		tKey = t.actor.items.find(item => item.getFlag("core","sourceId") === MORTAL_WEAKNESS_TARGET_SOURCEID)._id;
	} else if(evM === "personal-antithesis"){
		tKey = t.actor.items.find(item => item.getFlag("core","sourceId") === PERSONAL_ANTITHESIS_TARGET_SOURCEID)._id;
	} else {return}

	if(flag) {
		eff = trueThaum.getFlag("pf2e-thaum-vuln","EVValue");
	} else {eff = 0}
	let updates = {
		_id:tKey,
		system: {
			rules: [
				{
					key: "Weakness",
					type: "physical",
					value: eff,
					predicate: [
						""
					]
				}
			]
		}
	};
	
	await t.actor.updateEmbeddedDocuments('Item', [updates]);
}

//Deletes the effect from the actor passed to the method
async function _socketDeleteEVEffect(targ) {
	let eff;
	for(let act of targ){
		let a = await fromUuid(act);
		if(a.actor) {
			eff = getActorEVEffect(a.actor);
		} else {eff = getActorEVEffect(a);}
		eff.delete();
	}
}