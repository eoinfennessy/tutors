<script lang="ts">
	import ExperienceCard from './ExperienceCard.svelte';

	const title = 'Learner Experience';
	const icon = 'ph:student';
	const link = 'https://reader.tutors.dev/lab/tutors-docs/topic-03-DX/unit-0/book-plans/01';
	const content = `
The <strong><em>Learner Experience</em></strong> prioritises web interactions that are
<strong>engaging</strong>, <strong>contextual</strong>, <strong>linkable</strong>,
<strong>searchable</strong>, <strong>accessible</strong> and
<strong>responsive</strong>. In addition the experience should foster a sense of
<strong>community</strong>
and <strong>connection</strong> among fellow learners.`;
</script>

<ExperienceCard {title} {icon} {link} {content} />
