/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { randomUUID } from 'node:crypto';
import {
	Get,
	Post,
	Body,
	Param,
	Inject,
	Delete,
	Controller,
	NotFoundException,
	BadRequestException,
} from '@nestjs/common';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { CurrentUser } from '../auth/current-user.js';
import type { SemanticFormatGuidance } from '@codexa/provider';
import { PROFILE_REPOSITORY, type ProfileRepository } from '../persistence/repositories.js';

/**
|--------------------------------------------------
| Profile creation body
|--------------------------------------------------
*/
interface CreateProfileBody {
	name?: string;
	guidance?: Partial<SemanticFormatGuidance>;
}

/**
|--------------------------------------------------
| Saved style-profile endpoints
|--------------------------------------------------
*/
@Controller('profiles')
export class ProfilesController {
	/**
	|--------------------------------------------------
	| Inject the profile repository
	|--------------------------------------------------
	*/
	constructor(@Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository) {}

	/**
	|--------------------------------------------------
	| List the user's saved profiles
	|--------------------------------------------------
	*/
	@Get()
	list(@CurrentUser() userId: string) {
		/**
		|--------------------------------------------------
		| Return profiles owned by the user
		|--------------------------------------------------
		*/
		return this.profiles.list(userId);
	}

	/**
	|--------------------------------------------------
	| Create a saved profile
	|--------------------------------------------------
	*/
	@Post()
	create(@Body() body: CreateProfileBody, @CurrentUser() userId: string) {
		/**
		|--------------------------------------------------
		| Require a profile name
		|--------------------------------------------------
		*/
		if (!body.name?.trim()) throw new BadRequestException('Profile name is required.');

		/**
		|--------------------------------------------------
		| Persist the new profile
		|--------------------------------------------------
		*/
		return this.profiles.create({
			userId,
			id: randomUUID(),
			createdAt: Date.now(),
			name: body.name.trim(),
			guidance: body.guidance ?? {},
		});
	}

	/**
	|--------------------------------------------------
	| Delete a saved profile
	|--------------------------------------------------
	*/
	@Delete(':id')
	async remove(@Param('id') id: string, @CurrentUser() userId: string) {
		/**
		|--------------------------------------------------
		| Remove the profile, enforcing ownership
		|--------------------------------------------------
		*/
		const removed = await this.profiles.remove(userId, id);
		if (!removed) throw new NotFoundException(`Profile "${id}" was not found.`);
		return { removed: true };
	}
}
